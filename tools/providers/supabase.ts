import 'server-only'
import { z } from 'zod'
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

const SUPABASE_API_BASE = 'https://api.supabase.com'
const ABSOLUTE_URL_PATTERN = /^[a-z][a-z\d+.-]*:/i

const SUPABASE_ENDPOINT_GUIDE =
  'Allowed Supabase Management API paths begin with /v1/. Examples: /v1/projects, /v1/projects/{ref}, /v1/organizations, /v1/functions.'

const supabaseMethodSchema = z.enum(['GET', 'POST', 'PATCH', 'PUT', 'DELETE'])
const supabaseConfigSchema = z.object({
  readOnly: z
    .boolean()
    .default(true)
    .describe('When true, only GET requests are allowed across groups.'),
  enableGroupProjects: groupToggleField(
    'Projects',
    'Enable projects endpoints.'
  ),
  readOnlyGroupProjects: groupReadOnlyField(
    'Projects',
    'When true, project endpoints are read-only.'
  ),
  enableGroupOrganizations: groupToggleField(
    'Organizations',
    'Enable organizations endpoints.'
  ),
  readOnlyGroupOrganizations: groupReadOnlyField(
    'Organizations',
    'When true, organization endpoints are read-only.'
  ),
  enableGroupFunctions: groupToggleField(
    'Functions',
    'Enable functions endpoints.'
  ),
  readOnlyGroupFunctions: groupReadOnlyField(
    'Functions',
    'When true, functions endpoints are read-only.'
  ),
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

function isAllowedPath(pathname: string): boolean {
  return pathname === '/v1' || pathname.startsWith('/v1/')
}

function supabaseGroup(
  pathname: string
): 'Projects' | 'Organizations' | 'Functions' | 'Other' {
  if (pathname === '/v1/projects' || pathname.startsWith('/v1/projects/')) {
    return 'Projects'
  }
  if (
    pathname === '/v1/organizations' ||
    pathname.startsWith('/v1/organizations/')
  ) {
    return 'Organizations'
  }
  if (pathname === '/v1/functions' || pathname.startsWith('/v1/functions/')) {
    return 'Functions'
  }
  return 'Other'
}

const supabaseSafetyPolicy: ToolPolicy<
  SupabaseRequestInput,
  SupabaseConfig
> = ({ config, input }) => {
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

  let pathname: string
  try {
    pathname = normalizedSupabasePathname(input.path)
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Invalid path.',
    }
  }

  if (!isAllowedPath(pathname)) {
    return {
      ok: false,
      message: `Path "${pathname}" is outside the allowed Supabase Management API surface.`,
    }
  }

  const group = supabaseGroup(pathname)
  if (group === 'Projects') {
    const decision = enforceGroupAccess({
      enabled: config.enableGroupProjects,
      group,
      readOnly: config.readOnlyGroupProjects,
      method: input.method,
      globalReadOnly: config.readOnly,
    })
    if (!decision.ok) {
      return decision
    }
  }
  if (group === 'Organizations') {
    const decision = enforceGroupAccess({
      enabled: config.enableGroupOrganizations,
      group,
      readOnly: config.readOnlyGroupOrganizations,
      method: input.method,
      globalReadOnly: config.readOnly,
    })
    if (!decision.ok) {
      return decision
    }
  }
  if (group === 'Functions') {
    const decision = enforceGroupAccess({
      enabled: config.enableGroupFunctions,
      group,
      readOnly: config.readOnlyGroupFunctions,
      method: input.method,
      globalReadOnly: config.readOnly,
    })
    if (!decision.ok) {
      return decision
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

function serializeSupabaseJsonBody(body: SupabaseJsonValue): string {
  return JSON.stringify(body)
}

export const supabaseRequestTool = defineApiPassthroughTool({
  id: 'supabase_request',
  category: 'database',
  displayName: 'Supabase · Request',
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
