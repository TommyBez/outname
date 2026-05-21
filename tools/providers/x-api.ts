import 'server-only'
import { z } from 'zod'
import { X_OAUTH_SCOPES } from '@/connections/x-oauth-scopes'
import {
  defineApiPassthroughTool,
  type ToolPolicy,
  toolSuccess,
} from '@/tools/runtime/define-maintainer-tool'
import {
  parseProviderResponseFromHttp,
  toolErrorFromProviderResponse,
} from '@/tools/runtime/define-maintainer-tool/provider-response'

const X_API_BASE = 'https://api.x.com'
const X_API_DEFAULT_RESPONSE_BYTES = 12_000
const X_API_MAX_RESPONSE_BYTES = 64 * 1024
const ABSOLUTE_URL_PATTERN = /^[a-z][a-z\d+.-]*:/i

const X_ENDPOINT_GUIDE =
  'Use relative X API v2 paths such as /2/users/by/username/xdevelopers, /2/tweets/search/recent, /2/tweets, or /2/dm_conversations. Long-lived streaming response endpoints are not supported.'

const xApiMethodSchema = z.enum(['GET', 'POST', 'PATCH', 'PUT', 'DELETE'])
const xApiConfigSchema = z.object({
  readOnly: z
    .boolean()
    .default(false)
    .describe(
      'When true, only read operations are allowed. Non-GET methods are blocked.'
    ),
})

const xApiQueryValueSchema = z.union([z.string(), z.number(), z.boolean()])

const xApiRequestInputSchema = z.object({
  method: xApiMethodSchema
    .default('GET')
    .describe('HTTP method to use. GET is for read-only calls.'),
  path: z.string().min(1).describe(`Relative X API path. ${X_ENDPOINT_GUIDE}`),
  query: z
    .record(z.string(), xApiQueryValueSchema)
    .optional()
    .describe(
      'Optional query parameters. Use strings for comma-separated field lists such as tweet.fields or expansions.'
    ),
  body: z
    .record(z.string(), z.unknown())
    .optional()
    .describe('Optional JSON request body for non-GET requests.'),
  maxResponseBytes: z
    .number()
    .int()
    .min(1000)
    .max(X_API_MAX_RESPONSE_BYTES)
    .default(X_API_DEFAULT_RESPONSE_BYTES)
    .describe(
      'Maximum response body bytes to return, from 1000 to 65536. Increase for larger search or lookup responses.'
    ),
})

type XApiHttpMethod = z.infer<typeof xApiMethodSchema>
type XApiRequestInput = z.infer<typeof xApiRequestInputSchema>
type XApiConfig = z.infer<typeof xApiConfigSchema>

function normalizeXApiPath(path: string): string {
  const trimmed = path.trim()
  if (ABSOLUTE_URL_PATTERN.test(trimmed) || trimmed.startsWith('//')) {
    throw new Error('Path must be a relative X API path.')
  }
  if (!trimmed.startsWith('/')) {
    throw new Error('Path must start with "/".')
  }
  if (trimmed.includes('\n') || trimmed.includes('\r')) {
    throw new Error('Path must be a single line.')
  }
  return trimmed
}

function normalizedXApiPathname(path: string): string {
  return new URL(normalizeXApiPath(path), X_API_BASE).pathname
}

function isAllowedPath(pathname: string): boolean {
  return pathname === '/2/openapi.json' || pathname.startsWith('/2/')
}

function isStreamingResponsePath(pathname: string): boolean {
  return pathname.endsWith('/stream')
}

function isBlockedUserContextPath(pathname: string): boolean {
  const isUserNestedListPath =
    pathname.startsWith('/2/users/') &&
    (pathname.endsWith('/list_memberships') ||
      pathname.endsWith('/followed_lists'))
  return (
    pathname.startsWith('/2/dm') ||
    pathname.startsWith('/2/lists') ||
    isUserNestedListPath ||
    pathname.includes('/blocking') ||
    pathname.includes('/muting') ||
    pathname.startsWith('/2/spaces')
  )
}

function isAllowedUserContextPath(pathname: string): boolean {
  return (
    pathname === '/2/openapi.json' ||
    pathname.startsWith('/2/tweets') ||
    pathname.startsWith('/2/users') ||
    pathname.startsWith('/2/media')
  )
}

function isMutationMethod(method: XApiHttpMethod): boolean {
  return method !== 'GET'
}

const xApiSafetyPolicy: ToolPolicy<XApiRequestInput, XApiConfig> = ({
  config,
  input,
}) => {
  if (input.method === 'GET' && input.body !== undefined) {
    return { ok: false, message: 'GET requests cannot include a body.' }
  }

  let pathname: string
  try {
    pathname = normalizedXApiPathname(input.path)
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'Invalid path.',
    }
  }

  if (!isAllowedPath(pathname)) {
    return {
      ok: false,
      message: `Path "${pathname}" is outside the allowed X API v2 surface.`,
    }
  }

  if (isStreamingResponsePath(pathname)) {
    return {
      ok: false,
      message:
        'Long-lived X API streaming response endpoints are not supported by this tool.',
    }
  }

  if (config.readOnly && isMutationMethod(input.method)) {
    return {
      ok: false,
      message:
        'This tool attachment is configured as read-only. Only GET requests are allowed.',
    }
  }

  return { ok: true }
}

const xUserApiSafetyPolicy: ToolPolicy<XApiRequestInput, XApiConfig> = ({
  config,
  input,
  ctx,
}) => {
  const base = xApiSafetyPolicy({ config, input, ctx })
  if (!base.ok) {
    return base
  }

  const pathname = normalizedXApiPathname(input.path)
  if (
    !isAllowedUserContextPath(pathname) ||
    isBlockedUserContextPath(pathname)
  ) {
    return {
      ok: false,
      message:
        'This X OAuth user-context tool is limited to tweets, users/me, likes, follows, bookmarks, and media endpoints in v1. DM, list, mute, block, space, and other surfaces are not enabled.',
    }
  }

  return { ok: true }
}

function errorCodeForStatus(status: number) {
  if (status === 429) {
    return 'rate_limited'
  }
  return 'provider_error'
}

function appendQueryParams(
  url: URL,
  query: Record<string, string | number | boolean> | undefined
): void {
  for (const [key, value] of Object.entries(query ?? {})) {
    url.searchParams.append(key, String(value))
  }
}

export const xApiRequestTool = defineApiPassthroughTool({
  id: 'x_api_request',
  category: 'social',
  displayName: 'X API · App Request',
  description: `Call X API v2 endpoints on api.x.com with the app Bearer token connector. This tool does not act as an X user. ${X_ENDPOINT_GUIDE}`,
  connectorId: 'x.bearer_token',
  configSchema: xApiConfigSchema,
  inputSchema: xApiRequestInputSchema,
  policies: [xApiSafetyPolicy],
  toRequest({ input }) {
    const path = normalizeXApiPath(input.path)
    const url = new URL(`${X_API_BASE}${path}`)
    appendQueryParams(url, input.query)

    const headers: Record<string, string> = {}
    if (input.body !== undefined) {
      headers['content-type'] = 'application/json'
    }

    return {
      method: input.method,
      url: url.toString(),
      headers,
      body: input.body,
      maxResponseBytes: input.maxResponseBytes,
    }
  },
  handleResponse(response, { input }) {
    if (!response.ok) {
      return toolErrorFromProviderResponse(response, {
        label: 'X API request',
        errorCodeForStatus,
      })
    }

    const normalizedPath = normalizeXApiPath(input.path)
    return toolSuccess({
      status: response.status,
      normalizedPath,
      body: parseProviderResponseFromHttp(response),
      truncated: response.truncated,
    })
  },
})

export const xUserApiRequestTool = defineApiPassthroughTool({
  id: 'x_user_api_request',
  category: 'social',
  displayName: 'X API · OAuth User Request',
  description:
    'Call X API v2 user-context endpoints on api.x.com for tweets, users/me, likes, follows, bookmarks, and media upload.',
  connectorId: 'x.oauth2_user',
  requiredScopes: X_OAUTH_SCOPES,
  configSchema: xApiConfigSchema,
  inputSchema: xApiRequestInputSchema,
  policies: [xUserApiSafetyPolicy],
  toRequest({ input }) {
    const path = normalizeXApiPath(input.path)
    const url = new URL(`${X_API_BASE}${path}`)
    appendQueryParams(url, input.query)

    const headers: Record<string, string> = {}
    if (input.body !== undefined) {
      headers['content-type'] = 'application/json'
    }

    return {
      method: input.method,
      url: url.toString(),
      headers,
      body: input.body,
      maxResponseBytes: input.maxResponseBytes,
    }
  },
  handleResponse(response, { input }) {
    if (!response.ok) {
      return toolErrorFromProviderResponse(response, {
        label: 'X OAuth user request',
        errorCodeForStatus,
      })
    }

    const normalizedPath = normalizeXApiPath(input.path)
    return toolSuccess({
      status: response.status,
      normalizedPath,
      body: parseProviderResponseFromHttp(response),
      truncated: response.truncated,
    })
  },
})
