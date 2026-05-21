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

const POSTHOG_API_BASE = 'https://us.i.posthog.com'
const ABSOLUTE_URL_PATTERN = /^[a-z][a-z\d+.-]*:/i

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
    .record(z.string(), z.string())
    .optional()
    .describe('Optional query parameters appended as strings.'),
  body: z
    .record(z.string(), z.unknown())
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

function resolvePosthogUrl(path: string): URL {
  return new URL(path, POSTHOG_API_BASE)
}

function getCanonicalPosthogPathname(path: string): string {
  return resolvePosthogUrl(path).pathname
}

/** Pathname plus embedded query string (for responses / parity with raw input.path). */
function getCanonicalPosthogPathAndQuery(path: string): string {
  const resolved = resolvePosthogUrl(path)
  return `${resolved.pathname}${resolved.search}`
}

function buildExpectedProjectPrefix(projectId: string): string {
  return `/api/projects/${projectId.trim()}/`
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
  const canonicalPathname = getCanonicalPosthogPathname(normalizedPath)
  const expectedProjectPrefix = buildExpectedProjectPrefix(config.projectId)
  if (!canonicalPathname.startsWith(expectedProjectPrefix)) {
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
  connectorId: 'posthog.api_key',
  configSchema: posthogConfigSchema,
  inputSchema: posthogRequestInputSchema,
  policies: [posthogSafetyPolicy],
  toRequest({ input }) {
    const normalizedPath = normalizePosthogPath(input.path)
    const url = resolvePosthogUrl(normalizedPath)
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
        label: 'PostHog request',
      })
    }
    return toolSuccess({
      status: response.status,
      path: getCanonicalPosthogPathAndQuery(normalizePosthogPath(input.path)),
      method: input.method,
      readOnly: config.readOnly,
      body: parseProviderResponseFromHttp(response),
      truncated: response.truncated,
    })
  },
})
