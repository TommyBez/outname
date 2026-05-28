import 'server-only'
import { z } from 'zod'
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

const SUPABASE_API_BASE = 'https://api.supabase.com'
const ABSOLUTE_URL_PATTERN = /^[a-z][a-z\d+.-]*:/i

const SUPABASE_ENDPOINT_GUIDE =
  'Allowed Supabase Management API paths begin with /v1/. Examples: /v1, /v1/projects, /v1/organizations, /v1/branches, /v1/profile, /v1/oauth, and /v1/snippets.'

const SUPABASE_RESOURCES = [
  {
    key: 'api-root',
    label: 'API Root',
    enableDescription: 'Enable the /v1 API root endpoint.',
    readOnlyDescription: 'When true, the /v1 API root endpoint is read-only.',
  },
  { key: 'branches', label: 'Branches' },
  { key: 'oauth', label: 'OAuth' },
  { key: 'organizations', label: 'Organizations' },
  { key: 'profile', label: 'Profile' },
  { key: 'projects', label: 'Projects' },
  { key: 'snippets', label: 'Snippets' },
] as const satisfies readonly RestResourceDefinition[]

const supabaseMethodSchema = z.enum(['GET', 'POST', 'PATCH', 'PUT', 'DELETE'])
const supabaseConfigSchema = z.object({
  readOnly: z
    .boolean()
    .default(true)
    .describe('When true, only GET requests are allowed across groups.'),
  ...buildResourceConfigShape(SUPABASE_RESOURCES),
})

const supabaseQueryValueSchema = z.union([z.string(), z.number(), z.boolean()])
type SupabaseJsonValue =
  | boolean
  | null
  | number
  | string
  | SupabaseJsonValue[]
  | { [key: string]: SupabaseJsonValue }

const supabaseJsonBodySchema: z.ZodType<SupabaseJsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number().finite(),
    z.boolean(),
    z.null(),
    z.array(supabaseJsonBodySchema),
    z.record(z.string(), supabaseJsonBodySchema),
  ])
)

const supabaseRequestInputSchema = z.object({
  method: supabaseMethodSchema.default('GET').describe('HTTP method to use.'),
  path: z
    .string()
    .min(1)
    .describe(
      `Relative Supabase Management API path. ${SUPABASE_ENDPOINT_GUIDE}`
    ),
  query: z
    .record(z.string(), supabaseQueryValueSchema)
    .optional()
    .describe('Optional query parameters appended to the request URL.'),
  body: supabaseJsonBodySchema
    .optional()
    .describe(
      'Optional JSON request body for non-GET requests. Accepts objects, arrays, strings, numbers, booleans, and null.'
    ),
})

type SupabaseRequestInput = z.infer<typeof supabaseRequestInputSchema>
type SupabaseConfig = z.infer<typeof supabaseConfigSchema>

function normalizeSupabasePath(path: string): string {
  const trimmed = path.trim()
  if (ABSOLUTE_URL_PATTERN.test(trimmed) || trimmed.startsWith('//')) {
    throw new Error('Path must be a relative Supabase API path.')
  }
  if (!trimmed.startsWith('/')) {
    throw new Error('Path must start with "/".')
  }
  if (trimmed.includes('\n') || trimmed.includes('\r')) {
    throw new Error('Path must be a single line.')
  }
  return trimmed
}

function normalizedSupabasePathname(path: string): string {
  return new URL(normalizeSupabasePath(path), SUPABASE_API_BASE).pathname
}

function supabaseResourceKey(pathname: string): string | null {
  if (pathname === '/v1') {
    return 'api-root'
  }
  const parts = pathname.split('/').filter(Boolean)
  if (parts[0] !== 'v1') {
    return null
  }
  const resourceKey = parts[1]
  if (!resourceKey) {
    return 'api-root'
  }
  return findResourceDefinition(SUPABASE_RESOURCES, resourceKey)?.key ?? null
}

const supabaseSafetyPolicy: ToolPolicy<
  SupabaseRequestInput,
  SupabaseConfig
> = ({ config, input }) => {
  if (input.method === 'GET' && input.body !== undefined) {
    return { ok: false, message: 'GET requests cannot include a body.' }
  }

  let pathname: string
  try {
    pathname = normalizedSupabasePathname(input.path)
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Invalid path.',
    }
  }

  const resourceKey = supabaseResourceKey(pathname)
  if (!resourceKey) {
    return {
      ok: false,
      message: `Path "${pathname}" is outside the allowed Supabase Management API surface.`,
    }
  }
  const resource = findResourceDefinition(SUPABASE_RESOURCES, resourceKey)
  if (!resource) {
    return {
      ok: false,
      message: `Path "${pathname}" does not map to a declared Supabase resource.`,
    }
  }
  const decision = enforceResourceAccess({
    config,
    globalReadOnly: config.readOnly,
    method: input.method,
    resource,
  })
  if (!decision.ok) {
    return decision
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

function serializeSupabaseJsonBody(body: SupabaseJsonValue): string {
  return JSON.stringify(body)
}

export const supabaseRequestTool = defineApiPassthroughTool({
  id: 'supabase_request',
  category: 'database',
  displayName: 'Supabase · Request',
  displayDescription:
    'Manage Supabase projects, branches, functions, secrets, and organizations.',
  description: `Call authenticated Supabase Management API endpoints on api.supabase.com for projects, organizations, branches, functions, secrets, and related resources. ${SUPABASE_ENDPOINT_GUIDE}`,
  connectorId: 'supabase.personal_access_token',
  configSchema: supabaseConfigSchema,
  inputSchema: supabaseRequestInputSchema,
  policies: [supabaseSafetyPolicy],
  toRequest({ input }) {
    const path = normalizeSupabasePath(input.path)
    const url = new URL(`${SUPABASE_API_BASE}${path}`)
    appendQueryParams(url, input.query)

    const headers: Record<string, string> = {}
    if (input.body !== undefined) {
      headers['content-type'] = 'application/json'
    }

    return {
      method: input.method,
      url: url.toString(),
      headers,
      body:
        input.body === undefined
          ? undefined
          : serializeSupabaseJsonBody(input.body),
    }
  },
  handleResponse(response, { input }) {
    if (!response.ok) {
      return toolErrorFromProviderResponse(response, {
        label: 'Supabase API request',
        errorCodeForStatus,
      })
    }

    const normalizedPath = normalizeSupabasePath(input.path)
    return toolSuccess({
      status: response.status,
      normalizedPath,
      body: parseProviderResponseFromHttp(response),
      truncated: response.truncated,
    })
  },
})
