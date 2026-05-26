import 'server-only'
import { z } from 'zod'
import { X_OAUTH_SCOPES } from '@/connections/x-oauth-scopes'
import {
  enforceGroupAccess,
  groupReadOnlyField,
  groupToggleField,
} from '@/tools/providers/rest-resource-groups'
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
  'Relative path only, starting with /. Allowed: /2/openapi.json and /2/* (no /stream endpoints). Examples: /2/users/by/username/xdevelopers, /2/tweets/search/recent, /2/tweets, /2/users/me.'

const X_API_JSON_RULES =
  'Use strict JSON for every field: double-quoted keys and string values, no trailing commas, no comments. Dotted X API names such as tweet.fields and user.fields are object keys — quote them.'

const X_API_QUERY_GUIDE =
  'Optional nested object of URL query params (never a string). Each key is an X API query param name; each value is a string, number, or boolean. Comma-separated lists stay in the value string, e.g. "tweet.fields":"created_at,author_id,text". Search endpoints need a "query" key for the search expression. Example query object: {"query":"from:xdevelopers -is:retweet","max_results":10,"tweet.fields":"created_at,author_id,text","expansions":"author_id"}.'

const X_API_BODY_GUIDE =
  'Optional JSON object request body for POST, PATCH, PUT, or DELETE. Omit for GET. Use X API field names as object keys with strict JSON quoting.'

const X_API_INPUT_EXAMPLE =
  '{"method":"GET","path":"/2/tweets/search/recent","query":{"query":"from:xdevelopers -is:retweet","max_results":10,"tweet.fields":"created_at,author_id,text","expansions":"author_id"}}'

const xApiMethodSchema = z.enum(['GET', 'POST', 'PATCH', 'PUT', 'DELETE'])
const xApiConfigSchema = z.object({
  readOnly: z
    .boolean()
    .default(false)
    .describe('When true, only read operations are allowed across groups.'),
  enableGroupTweets: groupToggleField('Tweets', 'Enable tweets endpoints.'),
  readOnlyGroupTweets: groupReadOnlyField(
    'Tweets',
    'When true, tweet endpoints are read-only.',
    false
  ),
  enableGroupUsers: groupToggleField('Users', 'Enable users endpoints.'),
  readOnlyGroupUsers: groupReadOnlyField(
    'Users',
    'When true, user endpoints are read-only.',
    false
  ),
  enableGroupMedia: groupToggleField('Media', 'Enable media endpoints.'),
  readOnlyGroupMedia: groupReadOnlyField(
    'Media',
    'When true, media endpoints are read-only.',
    false
  ),
})

const xApiQueryValueSchema = z.union([z.string(), z.number(), z.boolean()])

const xApiRequestInputSchema = z.object({
  method: xApiMethodSchema
    .default('GET')
    .describe(
      'HTTP method. Use GET for reads. Use POST/PATCH/PUT/DELETE only when the endpoint mutates data; pair with body when required.'
    ),
  path: z
    .string()
    .min(1)
    .describe(
      `Relative X API path starting with /. ${X_ENDPOINT_GUIDE} Never pass a full https:// URL.`
    ),
  query: z
    .record(z.string(), xApiQueryValueSchema)
    .optional()
    .describe(`${X_API_QUERY_GUIDE} ${X_API_JSON_RULES}`),
  body: z
    .record(z.string(), z.unknown())
    .optional()
    .describe(`${X_API_BODY_GUIDE} ${X_API_JSON_RULES}`),
  maxResponseBytes: z
    .number()
    .int()
    .min(1000)
    .max(X_API_MAX_RESPONSE_BYTES)
    .default(X_API_DEFAULT_RESPONSE_BYTES)
    .describe(
      'Max response bytes to return (1000–65536). Default 12000. Raise for large search results if needed.'
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

function xApiGroup(pathname: string): 'Tweets' | 'Users' | 'Media' | 'Other' {
  if (pathname.startsWith('/2/tweets')) {
    return 'Tweets'
  }
  if (pathname.startsWith('/2/users')) {
    return 'Users'
  }
  if (pathname.startsWith('/2/media')) {
    return 'Media'
  }
  return 'Other'
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

  const group = xApiGroup(pathname)
  if (group === 'Tweets') {
    const decision = enforceGroupAccess({
      enabled: config.enableGroupTweets,
      group,
      readOnly: config.readOnlyGroupTweets,
      method: input.method,
      globalReadOnly: config.readOnly,
    })
    if (!decision.ok) {
      return decision
    }
  }
  if (group === 'Users') {
    const decision = enforceGroupAccess({
      enabled: config.enableGroupUsers,
      group,
      readOnly: config.readOnlyGroupUsers,
      method: input.method,
      globalReadOnly: config.readOnly,
    })
    if (!decision.ok) {
      return decision
    }
  }
  if (group === 'Media') {
    const decision = enforceGroupAccess({
      enabled: config.enableGroupMedia,
      group,
      readOnly: config.readOnlyGroupMedia,
      method: input.method,
      globalReadOnly: config.readOnly,
    })
    if (!decision.ok) {
      return decision
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
  description: `Call X API v2 on api.x.com with the app Bearer token (not as an X user). ${X_API_JSON_RULES} Example tool input: ${X_API_INPUT_EXAMPLE}.`,
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
  description: `Call X API v2 user-context endpoints on api.x.com (tweets, users/me, likes, follows, bookmarks, media). ${X_API_JSON_RULES} Example tool input: ${X_API_INPUT_EXAMPLE}.`,
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
