import 'server-only'
import { Buffer } from 'node:buffer'
import { type NetworkPolicy, Sandbox } from '@vercel/sandbox'
import { getConnector } from '@/connectors/registry'
import { readBrokeredCredential } from '@/connectors/runtime'

const DEFAULT_TIMEOUT_MS = 30_000
const DEFAULT_MAX_RESPONSE_BYTES = 12_000
const MAX_STDERR_BYTES = 2000
const FORBIDDEN_REQUEST_HEADERS = new Set([
  'authorization',
  'proxy-authorization',
  'x-api-key',
  'api-key',
  'apikey',
  'x-auth-token',
  'cookie',
  'set-cookie',
])

const FETCH_RUNNER = `
const input = JSON.parse(Buffer.from(process.argv[1], 'base64url').toString('utf8'));
const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), input.timeoutMs);
try {
  const response = await fetch(input.url, {
    method: input.method,
    headers: input.headers,
    body: input.bodyText,
    signal: controller.signal,
  });
  const buf = Buffer.from(await response.arrayBuffer());
  const clipped = buf.subarray(0, input.maxResponseBytes);
  const headers = {};
  for (const key of ['content-type', 'retry-after']) {
    const value = response.headers.get(key);
    if (value) headers[key] = value;
  }
  console.log(JSON.stringify({
    ok: response.ok,
    status: response.status,
    headers,
    bodyText: clipped.toString('utf8'),
    truncated: buf.length > input.maxResponseBytes,
  }));
} finally {
  clearTimeout(timer);
}
`

export interface BrokeredHttpRequest {
  body?: unknown
  headers?: Record<string, string>
  maxResponseBytes?: number
  method: string
  timeoutMs?: number
  url: string
}

export interface BrokeredHttpResponse {
  bodyText: string
  headers: Record<string, string>
  ok: boolean
  status: number
  truncated: boolean
}

export class BrokeredHttpError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BrokeredHttpError'
  }
}

function normalizeHeaders(headers: Record<string, string> | undefined) {
  const normalized: Record<string, string> = {}
  for (const [key, value] of Object.entries(headers ?? {})) {
    const lower = key.toLowerCase()
    if (FORBIDDEN_REQUEST_HEADERS.has(lower)) {
      throw new BrokeredHttpError(`Header "${key}" is managed by the broker.`)
    }
    normalized[lower] = value
  }
  return normalized
}

function validateUrl(
  provider: string,
  rawUrl: string,
  allowedHosts: readonly string[]
) {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    throw new BrokeredHttpError(`${provider}: request URL is invalid.`)
  }
  if (url.protocol !== 'https:') {
    throw new BrokeredHttpError(
      `${provider}: brokered requests must use HTTPS.`
    )
  }
  if (!allowedHosts.includes(url.hostname)) {
    throw new BrokeredHttpError(
      `${provider}: host "${url.hostname}" is not allowed for this connector.`
    )
  }
  return url
}

function responseLimit(
  connectorLimit: number | undefined,
  requestLimit: number | undefined
): number {
  const raw = requestLimit ?? connectorLimit ?? DEFAULT_MAX_RESPONSE_BYTES
  return Math.max(1, Math.min(raw, 64 * 1024))
}

function bodyTextFor(body: unknown): string | undefined {
  if (body === undefined) {
    return
  }
  return typeof body === 'string' ? body : JSON.stringify(body)
}

export async function brokeredHttpRequest(input: {
  agentId: string
  provider: string
  request: BrokeredHttpRequest
  toolId: string
  userId: string
}): Promise<BrokeredHttpResponse> {
  'use step'
  const connector = getConnector(input.provider)
  if (!connector) {
    throw new BrokeredHttpError(`Unknown provider: ${input.provider}`)
  }

  const url = validateUrl(
    input.provider,
    input.request.url,
    connector.broker.allowedHosts
  )
  const headers = normalizeHeaders(input.request.headers)
  const credential = await readBrokeredCredential({
    provider: input.provider,
    userId: input.userId,
  })
  const injectedHeaders = connector.broker.injectedHeaders(credential)
  const networkPolicy: NetworkPolicy = {
    allow: {
      [url.hostname]: [
        {
          transform: [{ headers: injectedHeaders }],
        },
      ],
    },
  }

  const runnerInput = {
    url: url.toString(),
    method: input.request.method.toUpperCase(),
    headers,
    bodyText: bodyTextFor(input.request.body),
    timeoutMs: input.request.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    maxResponseBytes: responseLimit(
      connector.broker.maxResponseBytes,
      input.request.maxResponseBytes
    ),
  }

  let sandbox: Sandbox | null = null
  try {
    sandbox = await Sandbox.create({
      runtime: 'node24',
      timeout: Math.max(runnerInput.timeoutMs + 10_000, DEFAULT_TIMEOUT_MS),
      networkPolicy,
      resources: { vcpus: 1 },
    })
    const encoded = Buffer.from(JSON.stringify(runnerInput)).toString(
      'base64url'
    )
    const result = await sandbox.runCommand('node', [
      '--input-type=module',
      '-e',
      FETCH_RUNNER,
      encoded,
    ])
    const [stdout, stderr] = await Promise.all([
      result.stdout(),
      result.stderr(),
    ])
    if (result.exitCode !== 0) {
      throw new BrokeredHttpError(
        `${input.toolId}: brokered request failed (${stderr.slice(0, MAX_STDERR_BYTES)})`
      )
    }
    return JSON.parse(stdout) as BrokeredHttpResponse
  } finally {
    if (sandbox) {
      await sandbox.stop().catch((err) => {
        console.error('[v0] brokeredHttpRequest: sandbox.stop failed', {
          agentId: input.agentId,
          toolId: input.toolId,
          err,
        })
      })
    }
  }
}
