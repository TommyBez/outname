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

const VERCEL_API_BASE = 'https://api.vercel.com'
const ABSOLUTE_URL_PATTERN = /^[a-z][a-z\d+.-]*:/i

const vercelMethodSchema = z.enum(['GET', 'POST', 'PATCH', 'PUT', 'DELETE'])

const vercelConfigSchema = z.object({
  readOnly: z
    .boolean()
    .default(true)
    .describe('When true, only read operations are allowed for all groups.'),
  enableGroupProjects: groupToggleField(
    'Projects',
    'Enable access to project endpoints.'
  ),
  readOnlyGroupProjects: groupReadOnlyField(
    'Projects',
    'When true, project endpoints are read-only.'
  ),
  enableGroupTeams: groupToggleField(
    'Teams',
    'Enable access to team endpoints.'
  ),
  readOnlyGroupTeams: groupReadOnlyField(
    'Teams',
    'When true, team endpoints are read-only.'
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
    .record(z.string(), z.string())
    .optional()
    .describe('Optional query string pairs appended to the request URL.'),
  body: z
    .record(z.string(), z.unknown())
    .optional()
    .describe('Optional JSON request body for non-GET requests.'),
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

function vercelGroup(path: string): 'Projects' | 'Teams' | 'Other' {
  const p = normalizeVercelPath(path)
  if (p.includes('/projects')) {
    return 'Projects'
  }
  if (p.includes('/teams')) {
    return 'Teams'
  }
  return 'Other'
}

const vercelSafetyPolicy: ToolPolicy<VercelRequestInput, VercelConfig> = ({
  config,
  input,
}) => {
  if (input.method === 'GET' && input.body !== undefined) {
    return { ok: false, message: 'GET requests cannot include a body.' }
  }
  const group = vercelGroup(input.path)
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
  if (group === 'Teams') {
    const decision = enforceGroupAccess({
      enabled: config.enableGroupTeams,
      group,
      readOnly: config.readOnlyGroupTeams,
      method: input.method,
      globalReadOnly: config.readOnly,
    })
    if (!decision.ok) {
      return decision
    }
  }
  if (group === 'Other' && config.readOnly && input.method !== 'GET') {
    return {
      ok: false,
      message:
        'This tool attachment is configured as read-only. Only GET requests are allowed.',
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
    'Call authenticated Vercel REST API endpoints. Supports read-only attachment mode.',
  connectorId: 'vercel.api_token',
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
      method: input.method,
      path: normalizeVercelPath(input.path),
      body: parseProviderResponseFromHttp(response),
      truncated: response.truncated,
    })
  },
})
