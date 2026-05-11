import 'server-only'
import { z } from 'zod'
import {
  defineApiPassthroughTool,
  type ToolPolicy,
  toolError,
  toolSuccess,
} from '@/tools/runtime/define-maintainer-tool'

const POSTHOG_API_BASE = 'https://us.i.posthog.com'
const ABSOLUTE_URL_PATTERN = /^[a-z][a-z\d+.-]*:/i
const PROVIDER_ERROR_BODY_LIMIT = 1000

const posthogConfigSchema = z.object({
  projectId: z
    .string()
    .min(1)
    .describe('Allowed PostHog project ID for this tool attachment.'),
  readOnly: z
    .boolean()
    .default(true)
    .describe('When true, only GET requests are allowed. Recommended default.'),
})

const posthogMethodSchema = z.enum(['GET', 'POST', 'PATCH', 'PUT', 'DELETE'])

const posthogRequestInputSchema = z.object({
  method: posthogMethodSchema.describe(
    'HTTP method to use for the PostHog API call.'
  ),
  path: z
    .string()
    .min(1)
    .describe('Relative API path beginning with /api/projects/{projectId}/.'),
  query: z
    .record(z.string())
    .optional()
    .describe('Optional query parameters appended as strings.'),
  body: z
    .record(z.unknown())
    .optional()
    .describe('Optional JSON request body for non-GET requests.'),
  confirmIrreversible: z
    .boolean()
    .default(false)
    .describe('Set true for non-GET requests when readOnly is disabled.'),
})

type PosthogRequestInput = z.infer<typeof posthogRequestInputSchema>
type PosthogToolConfig = z.infer<typeof posthogConfigSchema>

function normalizePosthogPath(path: string): string {
  const trimmed = path.trim()
  if (ABSOLUTE_URL_PATTERN.test(trimmed) || trimmed.startsWith('//')) {
    throw new Error('Path must be a relative PostHog API path.')
  }
  if (!trimmed.startsWith('/')) {
    throw new Error('Path must start with "/".')
  }
  if (trimmed.includes('\n') || trimmed.includes('\r')) {
    throw new Error('Path must be a single line.')
  }
  return trimmed
}

function getCanonicalPosthogPath(path: string): string {
  return new URL(`${POSTHOG_API_BASE}${path}`).pathname
}

function buildExpectedProjectPrefix(projectId: string): string {
  return `/api/projects/${projectId.trim()}/`
}

function parseResponseBody(
  raw: string,
  contentType: string | undefined
): unknown {
  if (raw.length === 0) {
    return null
  }
  if (contentType?.includes('application/json')) {
    try {
      return JSON.parse(raw) as unknown
    } catch {
      return raw
    }
  }
  return raw
}

function clippedProviderError(response: {
  bodyText: string
  status: number
  truncated: boolean
}): string {
  const body = response.bodyText.trim()
  if (!body) {
    return `PostHog request failed (HTTP ${response.status}).`
  }
  const truncated =
    response.truncated || body.length > PROVIDER_ERROR_BODY_LIMIT
  const suffix = truncated ? ' [truncated]' : ''
  return `PostHog request failed (HTTP ${response.status}): ${body.slice(0, PROVIDER_ERROR_BODY_LIMIT)}${suffix}`
}

const posthogSafetyPolicy: ToolPolicy<
  PosthogRequestInput,
  PosthogToolConfig
> = ({ input, config }) => {
  if (input.method === 'GET' && input.body !== undefined) {
    return { ok: false, message: 'GET requests cannot include a body.' }
  }
  let normalizedPath: string
  try {
    normalizedPath = normalizePosthogPath(input.path)
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'Invalid path.',
    }
  }
  const canonicalPath = getCanonicalPosthogPath(normalizedPath)
  const expectedProjectPrefix = buildExpectedProjectPrefix(config.projectId)
  if (!canonicalPath.startsWith(expectedProjectPrefix)) {
    return {
      ok: false,
      message:
        'Path must stay inside /api/projects/{projectId}/ endpoints for the configured project ID.',
    }
  }
  if (config.readOnly && input.method !== 'GET') {
    return {
      ok: false,
      message: 'This attachment is read-only. Use GET requests only.',
    }
  }
  if (
    !config.readOnly &&
    input.method !== 'GET' &&
    !input.confirmIrreversible
  ) {
    return {
      ok: false,
      message:
        'Non-GET PostHog requests require confirmIrreversible=true when readOnly is disabled.',
    }
  }
  return { ok: true }
}

export const posthogRequestTool = defineApiPassthroughTool({
  id: 'posthog_request',
  category: 'analytics',
  displayName: 'PostHog · Request',
  description:
    'Call authenticated PostHog project API endpoints. Defaults to read-only mode for safer analytics retrieval.',
  provider: 'posthog',
  configSchema: posthogConfigSchema,
  inputSchema: posthogRequestInputSchema,
  policies: [posthogSafetyPolicy],
  toRequest({ input }) {
    const normalizedPath = normalizePosthogPath(input.path)
    const canonicalPath = getCanonicalPosthogPath(normalizedPath)
    const url = new URL(`${POSTHOG_API_BASE}${canonicalPath}`)
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
      return toolError('provider_error', clippedProviderError(response))
    }
    return toolSuccess({
      status: response.status,
      path: getCanonicalPosthogPath(normalizePosthogPath(input.path)),
      method: input.method,
      readOnly: config.readOnly,
      body: parseResponseBody(
        response.bodyText,
        response.headers['content-type']
      ),
      truncated: response.truncated,
    })
  },
})
