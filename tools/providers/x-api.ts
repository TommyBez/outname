import 'server-only'
import { z } from 'zod'
import { X_OAUTH_SCOPES } from '@/connections/x-oauth-scopes'
import {
  buildResourceConfigShape,
  enforceResourceAccess,
  findResourceDefinition,
  type RestResourceDefinition,
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
const RESOURCE_LABEL_SEPARATOR_PATTERN = /[_-]+/

const X_ENDPOINT_GUIDE =
  'Relative path only, starting with /. Allowed declared X API v2 resources include /2/openapi.json, /2/account, /2/account_activity, /2/connections, /2/dm_conversations, /2/dm_events, /2/evaluate_note, /2/lists, /2/media, /2/news, /2/notes, /2/posts, /2/spaces, /2/tweets, /2/users, and /2/webhooks. Long-lived /stream endpoints are not supported.'

const X_USER_ENDPOINT_GUIDE =
  'Relative path only, starting with /. OAuth user-context resources include /2/openapi.json, /2/tweets, /2/users, /2/media, /2/lists, /2/spaces, /2/dm_events, and /2/dm_conversations. Long-lived /stream endpoints are not supported.'

const X_API_JSON_RULES =
  'Use strict JSON for every field: double-quoted keys and string values, no trailing commas, no comments. Dotted X API names such as tweet.fields and user.fields are object keys — quote them.'

const X_API_QUERY_GUIDE =
  'Optional nested object of URL query params (never a string). Each key is an X API query param name; each value is a string, number, or boolean. Comma-separated lists stay in the value string, e.g. "tweet.fields":"created_at,author_id,text". Search endpoints need a "query" key for the search expression. Example query object: {"query":"from:xdevelopers -is:retweet","max_results":10,"tweet.fields":"created_at,author_id,text","expansions":"author_id"}.'

const X_API_BODY_GUIDE =
  'Optional JSON object request body for POST, PATCH, PUT, or DELETE. Omit for GET. Use X API field names as object keys with strict JSON quoting.'

const X_API_INPUT_EXAMPLE =
  '{"method":"GET","path":"/2/tweets/search/recent","query":{"query":"from:xdevelopers -is:retweet","max_results":10,"tweet.fields":"created_at,author_id,text","expansions":"author_id"}}'

const xApiMethodSchema = z.enum(['GET', 'POST', 'PATCH', 'PUT', 'DELETE'])
const X_APP_RESOURCE_KEYS = [
  'openapi',
  'account',
  'account_activity',
  'connections',
  'dm_conversations',
  'dm_events',
  'evaluate_note',
  'lists',
  'media',
  'news',
  'notes',
  'posts',
  'spaces',
  'tweets',
  'users',
  'webhooks',
] as const

const X_USER_RESOURCE_KEYS = [
  'openapi',
  'tweets',
  'users',
  'media',
  'lists',
  'spaces',
  'dm_events',
  'dm_conversations',
] as const

function toXLabel(key: string): string {
  if (key === 'openapi') {
    return 'OpenAPI'
  }
  return key
    .split(RESOURCE_LABEL_SEPARATOR_PATTERN)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(' ')
}

function makeXResources<const T extends readonly string[]>(
  keys: T
): readonly RestResourceDefinition[] {
  return keys.map((key) => ({
    key,
    label: toXLabel(key),
    defaultReadOnly: key === 'openapi',
    enableDescription:
      key === 'openapi'
        ? 'Enable the /2/openapi.json metadata endpoint.'
        : undefined,
    readOnlyDescription:
      key === 'openapi'
        ? 'When true, the /2/openapi.json metadata endpoint is read-only.'
        : undefined,
  }))
}

const X_APP_RESOURCES = makeXResources(X_APP_RESOURCE_KEYS)
const X_USER_RESOURCES = makeXResources(X_USER_RESOURCE_KEYS)

const xApiConfigSchema = z.object({
  readOnly: z
    .boolean()
    .default(false)
    .describe('When true, only read operations are allowed across groups.'),
  ...buildResourceConfigShape(X_APP_RESOURCES),
})

const xUserApiConfigSchema = z.object({
  readOnly: z
    .boolean()
    .default(false)
    .describe('When true, only read operations are allowed across groups.'),
  ...buildResourceConfigShape(X_USER_RESOURCES),
})

const xApiQueryValueSchema = z.union([z.string(), z.number(), z.boolean()])

function buildXApiRequestInputSchema(endpointGuide: string) {
  return z.object({
    method: xApiMethodSchema
      .default('GET')
      .describe(
        'HTTP method. Use GET for reads. Use POST/PATCH/PUT/DELETE only when the endpoint mutates data; pair with body when required.'
      ),
    path: z
      .string()
      .min(1)
      .describe(
        `Relative X API path starting with /. ${endpointGuide} Never pass a full https:// URL.`
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
}

const xApiRequestInputSchema = buildXApiRequestInputSchema(X_ENDPOINT_GUIDE)
const xUserApiRequestInputSchema = buildXApiRequestInputSchema(
  X_USER_ENDPOINT_GUIDE
)

type XApiRequestInput = z.infer<typeof xApiRequestInputSchema>
type XApiConfig = z.infer<typeof xApiConfigSchema>
type XUserApiConfig = z.infer<typeof xUserApiConfigSchema>

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

function xApiResourceKey(pathname: string): string | null {
  if (pathname === '/2/openapi.json') {
    return 'openapi'
  }
  const parts = pathname.split('/').filter(Boolean)
  if (parts[0] !== '2') {
    return null
  }
  return parts[1] ?? null
}

function isStreamingResponsePath(pathname: string): boolean {
  return pathname.endsWith('/stream')
}

function resolveXResource(
  pathname: string,
  resources: readonly RestResourceDefinition[]
): RestResourceDefinition | null {
  const resourceKey = xApiResourceKey(pathname)
  if (!resourceKey) {
    return null
  }
  return findResourceDefinition(resources, resourceKey)
}

function validateXApiPath(input: XApiRequestInput):
  | {
      ok: false
      message: string
    }
  | {
      ok: true
      pathname: string
    } {
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

  if (!pathname.startsWith('/2/')) {
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

  return { ok: true, pathname }
}

function enforceXResourcePolicy(args: {
  config: Record<string, unknown>
  input: XApiRequestInput
  pathname: string
  resources: readonly RestResourceDefinition[]
}): { ok: true } | { ok: false; message: string } {
  const resource = resolveXResource(args.pathname, args.resources)
  if (!resource) {
    return {
      ok: false,
      message: `Path "${args.pathname}" is outside the declared X API resource surface.`,
    }
  }
  return enforceResourceAccess({
    config: args.config,
    globalReadOnly: Boolean(args.config.readOnly),
    method: args.input.method,
    resource,
  })
}

const xApiSafetyPolicy: ToolPolicy<XApiRequestInput, XApiConfig> = ({
  config,
  input,
}) => {
  const validation = validateXApiPath(input)
  if (!validation.ok) {
    return validation
  }
  return enforceXResourcePolicy({
    config,
    input,
    pathname: validation.pathname,
    resources: X_APP_RESOURCES,
  })
}

const xUserApiSafetyPolicy: ToolPolicy<XApiRequestInput, XUserApiConfig> = ({
  config,
  input,
}) => {
  const validation = validateXApiPath(input)
  if (!validation.ok) {
    return validation
  }
  return enforceXResourcePolicy({
    config,
    input,
    pathname: validation.pathname,
    resources: X_USER_RESOURCES,
  })
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
  displayDescription:
    'Read public X data using your app credentials (not as a signed-in user).',
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
  displayDescription:
    'Post, like, follow, bookmark, list, DM, and manage your X account on your behalf.',
  description: `Call X API v2 OAuth user-context endpoints on api.x.com (posts, users, likes, follows, bookmarks, lists, DMs, Spaces, media). ${X_API_JSON_RULES} Example tool input: ${X_API_INPUT_EXAMPLE}.`,
  connectorId: 'x.oauth2_user',
  requiredScopes: X_OAUTH_SCOPES,
  configSchema: xUserApiConfigSchema,
  inputSchema: xUserApiRequestInputSchema,
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
