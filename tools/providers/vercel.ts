import 'server-only'
import { z } from 'zod'
import {
  defineApiPassthroughTool,
  type ToolPolicy,
  toolSuccess,
} from '@/tools/runtime/define-maintainer-tool'
import {
  parseProviderResponseFromHttp,
  toolErrorFromProviderResponse,
} from '@/tools/runtime/define-maintainer-tool/provider-response'

const VERCEL_API_BASE = 'https://api.vercel.com'
const ABSOLUTE_URL_PATTERN = /^[a-z][a-z\d+.-]*:/i

const vercelMethodSchema = z.enum(['GET', 'POST', 'PATCH', 'PUT', 'DELETE'])

const vercelConfigSchema = z.object({
  readOnly: z
    .boolean()
    .default(true)
    .describe(
      'When true, only read operations are allowed (GET/HEAD-style usage). Set false to allow write and delete operations.'
    ),
})

const vercelRequestInputSchema = z.object({
  method: vercelMethodSchema.describe(
    'HTTP method for the Vercel REST API call.'
  ),
  path: z
    .string()
    .min(1)
    .describe(
      'Relative API path, for example /v10/projects or /v9/teams/{teamId}.'
    ),
  query: z
    .record(z.string())
    .optional()
    .describe('Optional query string pairs appended to the request URL.'),
  body: z
    .record(z.unknown())
    .optional()
    .describe('Optional JSON request body for non-GET requests.'),
  confirmIrreversible: z
    .boolean()
    .default(false)
    .describe(
      'Local safety confirmation flag (not sent to Vercel). Required true for any non-GET request when readOnly is disabled.'
    ),
})

type VercelRequestInput = z.infer<typeof vercelRequestInputSchema>
type VercelConfig = z.infer<typeof vercelConfigSchema>

function normalizeVercelPath(path: string): string {
  const trimmed = path.trim()
  if (ABSOLUTE_URL_PATTERN.test(trimmed) || trimmed.startsWith('//')) {
    throw new Error('Path must be a relative Vercel API path.')
  }
  if (!trimmed.startsWith('/')) {
    throw new Error('Path must start with "/".')
  }
  if (trimmed.includes('\n') || trimmed.includes('\r')) {
    throw new Error('Path must be a single line.')
  }
  return trimmed
}

const vercelSafetyPolicy: ToolPolicy<VercelRequestInput, VercelConfig> = ({
  config,
  input,
}) => {
  if (input.method === 'GET' && input.body !== undefined) {
    return { ok: false, message: 'GET requests cannot include a body.' }
  }
  if (config.readOnly && input.method !== 'GET') {
    return {
      ok: false,
      message:
        'This tool attachment is configured as read-only. Only GET requests are allowed.',
    }
  }
  if (
    input.method !== 'GET' &&
    !config.readOnly &&
    !input.confirmIrreversible
  ) {
    return {
      ok: false,
      message:
        'Non-GET requests require confirmIrreversible=true when readOnly is disabled.',
    }
  }
  try {
    normalizeVercelPath(input.path)
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'Invalid path.',
    }
  }
  return { ok: true }
}

export const vercelRequestTool = defineApiPassthroughTool({
  id: 'vercel_request',
  category: 'deployment',
  displayName: 'Vercel · Request',
  description:
    'Call authenticated Vercel REST API endpoints. Supports read-only attachment mode and explicit local safety confirmation for write operations.',
  provider: 'vercel',
  configSchema: vercelConfigSchema,
  inputSchema: vercelRequestInputSchema,
  policies: [vercelSafetyPolicy],
  toRequest({ input }) {
    const normalizedPath = normalizeVercelPath(input.path)
    const url = new URL(normalizedPath, VERCEL_API_BASE)
    for (const [key, value] of Object.entries(input.query ?? {})) {
      url.searchParams.append(key, value)
    }
    return {
      method: input.method,
      url: url.toString(),
      headers: {
        'content-type': 'application/json',
      },
      body: input.body,
    }
  },
  handleResponse(response, { input, config }) {
    if (!response.ok) {
      return toolErrorFromProviderResponse(response, {
        label: 'Vercel API request',
      })
    }
    return toolSuccess({
      status: response.status,
      readOnlyEnforced: config.readOnly,
      confirmIrreversibleChecked: input.method !== 'GET',
      method: input.method,
      path: normalizeVercelPath(input.path),
      body: parseProviderResponseFromHttp(response),
      truncated: response.truncated,
    })
  },
})
