import 'server-only'
import { Buffer } from 'node:buffer'
import { type NetworkPolicy, Sandbox } from '@vercel/sandbox'
import { getWorkflowMetadata } from 'workflow'
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

interface CachedBrokerSandbox {
  provider: string
  sandboxPromise: Promise<Sandbox>
}

/**
 * Per-workflow-run broker sandbox pool.
 *
 * This mirrors `lib/tool-sandbox-runtime.ts`: the cache is module-local
 * and best-effort, so a cross-pod `endOfEvent` may miss a sandbox that
 * was created elsewhere. In that case Vercel's 10-minute sandbox
 * timeout is the cleanup backstop. Credentials are injected into the
 * network policy once when the sandbox is created; a key rotated
 * mid-event takes effect on the next event/run.
 */
const brokerSandboxCache = new Map<string, Map<string, CachedBrokerSandbox>>()

function currentRunId(): string {
  return getWorkflowMetadata().workflowRunId
}

function normalizeHeaders(
  headers: Record<string, string> | undefined,
  injectedHeaderNames: readonly string[]
) {
  const normalized: Record<string, string> = {}
  const brokerManagedHeaders = new Set([
    ...FORBIDDEN_REQUEST_HEADERS,
    ...injectedHeaderNames.map((header) => header.toLowerCase()),
  ])
  for (const [key, value] of Object.entries(headers ?? {})) {
    const lower = key.toLowerCase()
    if (brokerManagedHeaders.has(lower)) {
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

function validateInjectedHeaders(
  provider: string,
  declaredHeaderNames: readonly string[],
  injectedHeaders: Record<string, string>
): Record<string, string> {
  const declared = new Set(
    declaredHeaderNames.map((header) => header.toLowerCase())
  )
  const normalized: Record<string, string> = {}
  for (const [key, value] of Object.entries(injectedHeaders)) {
    const lower = key.toLowerCase()
    if (!declared.has(lower)) {
      throw new BrokeredHttpError(
        `${provider}: connector injected undeclared header "${key}".`
      )
    }
    normalized[lower] = value
  }
  for (const key of declared) {
    if (!(key in normalized)) {
      throw new BrokeredHttpError(
        `${provider}: connector did not provide declared header "${key}".`
      )
    }
  }
  return normalized
}

function createNetworkPolicy(
  allowedHosts: readonly string[],
  injectedHeaders: Record<string, string>
): NetworkPolicy {
  const allow: Record<
    string,
    { transform: { headers: Record<string, string> }[] }[]
  > = {}
  for (const host of allowedHosts) {
    allow[host] = [{ transform: [{ headers: injectedHeaders }] }]
  }
  return { allow } as NetworkPolicy
}

async function getOrCreateBrokerSandbox(input: {
  createSandbox: () => Promise<Sandbox>
  provider: string
  runId: string
}): Promise<Sandbox> {
  let perRun = brokerSandboxCache.get(input.runId)
  if (perRun) {
    const cached = perRun.get(input.provider)
    if (cached) {
      return await cached.sandboxPromise
    }
  } else {
    perRun = new Map()
    brokerSandboxCache.set(input.runId, perRun)
  }

  const sandboxPromise = input.createSandbox().catch((err) => {
    perRun?.delete(input.provider)
    throw err
  })
  perRun.set(input.provider, {
    provider: input.provider,
    sandboxPromise,
  })
  return await sandboxPromise
}

async function createBrokerSandbox(input: {
  connector: NonNullable<ReturnType<typeof getConnector>>
  provider: string
  userId: string
}): Promise<Sandbox> {
  const credential = await readBrokeredCredential({
    provider: input.provider,
    userId: input.userId,
  })
  const injectedHeaders = validateInjectedHeaders(
    input.provider,
    input.connector.broker.injectedHeaderNames,
    input.connector.broker.injectedHeaders(credential)
  )
  const networkPolicy = createNetworkPolicy(
    input.connector.broker.allowedHosts,
    injectedHeaders
  )
  return await Sandbox.create({
    runtime: 'node24',
    timeout: 600_000,
    networkPolicy,
    resources: { vcpus: 1 },
  })
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
  const headers = normalizeHeaders(
    input.request.headers,
    connector.broker.injectedHeaderNames
  )
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

  const sandbox = await getOrCreateBrokerSandbox({
    runId: currentRunId(),
    provider: input.provider,
    createSandbox: () =>
      createBrokerSandbox({
        connector,
        provider: input.provider,
        userId: input.userId,
      }),
  })
  const encoded = Buffer.from(JSON.stringify(runnerInput)).toString('base64url')
  const result = await sandbox.runCommand('node', [
    '--input-type=module',
    '-e',
    FETCH_RUNNER,
    encoded,
  ])
  const [stdout, stderr] = await Promise.all([result.stdout(), result.stderr()])
  if (result.exitCode !== 0) {
    throw new BrokeredHttpError(
      `${input.toolId}: brokered request failed (${stderr.slice(0, MAX_STDERR_BYTES)})`
    )
  }
  return JSON.parse(stdout) as BrokeredHttpResponse
}

export async function stopAllBrokeredHttpSandboxesForRun(): Promise<void> {
  let runId: string
  try {
    runId = currentRunId()
  } catch {
    return
  }

  const perRun = brokerSandboxCache.get(runId)
  if (!perRun || perRun.size === 0) {
    brokerSandboxCache.delete(runId)
    return
  }

  await Promise.all(
    Array.from(perRun.values()).map(async ({ provider, sandboxPromise }) => {
      try {
        const sandbox = await sandboxPromise
        await sandbox.stop()
      } catch (err) {
        console.error('[v0] stopAllBrokeredHttpSandboxesForRun: stop failed', {
          provider,
          err,
        })
      }
    })
  )
  brokerSandboxCache.delete(runId)
}
