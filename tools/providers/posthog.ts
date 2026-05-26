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

const POSTHOG_API_BASE_BY_REGION = {
  eu: 'https://eu.posthog.com',
  us: 'https://us.posthog.com',
} as const
const ABSOLUTE_URL_PATTERN = /^[a-z][a-z\d+.-]*:/i

const posthogConfigSchema = z.object({
  region: z
    .enum(['us', 'eu'])
    .default('us')
    .describe(
      'PostHog server region for this workspace. Choose "us" for US Cloud or "eu" for EU Cloud.'
    ),
  enableGroupAnnotations: groupToggleField(
    'Annotations',
    'Enable annotation endpoints.'
  ),
  readOnlyGroupAnnotations: groupReadOnlyField(
    'Annotations',
    'When true, annotation endpoints are read-only.'
  ),
  disabledResourceGroups: z
    .array(z.string().min(1))
    .default([])
    .describe(
      '[Group: Advanced] Optional list of PostHog resource groups to disable entirely (derived from the first path segment under /api/projects/{projectId}/...). Example: ["insights","dashboards","feature_flags"].'
    ),
  readOnlyResourceGroups: z
    .array(z.string().min(1))
    .default([])
    .describe(
      '[Group: Advanced] Optional list of PostHog resource groups that should be read-only (mutating methods blocked). Example: ["insights","cohorts"].'
    ),
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

function resolvePosthogUrl(path: string, region: 'eu' | 'us'): URL {
  return new URL(path, POSTHOG_API_BASE_BY_REGION[region])
}

function getCanonicalPosthogPathname(
  path: string,
  region: 'eu' | 'us'
): string {
  return resolvePosthogUrl(path, region).pathname
}

/** Pathname plus embedded query string (for responses / parity with raw input.path). */
function getCanonicalPosthogPathAndQuery(
  path: string,
  region: 'eu' | 'us'
): string {
  const resolved = resolvePosthogUrl(path, region)
  return `${resolved.pathname}${resolved.search}`
}

function buildExpectedProjectPrefix(projectId: string): string {
  return `/api/projects/${projectId.trim()}/`
}

function posthogResourceGroup(
  canonicalPathname: string,
  projectPrefix: string
): string {
  const rest = canonicalPathname.slice(projectPrefix.length)
  const firstSegment = rest.split('/').filter(Boolean)[0]
  if (!firstSegment) {
    return 'Project Root'
  }
  return firstSegment
    .split('-')
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(' ')
}

function normalizeGroupKey(group: string): string {
  return group.trim().toLowerCase().replaceAll(' ', '_')
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
  const canonicalPathname = getCanonicalPosthogPathname(
    normalizedPath,
    config.region
  )
  const expectedProjectPrefix = buildExpectedProjectPrefix(config.projectId)
  if (!canonicalPathname.startsWith(expectedProjectPrefix)) {
    return {
      ok: false,
      message:
        'Path must stay inside /api/projects/{projectId}/ endpoints for the configured project ID.',
    }
  }
  const group = posthogResourceGroup(canonicalPathname, expectedProjectPrefix)
  if (group === 'Annotations') {
    const d = enforceGroupAccess({
      enabled: config.enableGroupAnnotations,
      group,
      readOnly: config.readOnlyGroupAnnotations,
      method: input.method,
      globalReadOnly: config.readOnly,
    })
    if (!d.ok) {
      return d
    }
  }
  const normalizedGroup = normalizeGroupKey(group)
  if (
    config.disabledResourceGroups.some(
      (g) => normalizeGroupKey(g) === normalizedGroup
    )
  ) {
    return {
      ok: false,
      message: `The ${group} resource group is disabled for this attachment.`,
    }
  }
  if (
    config.readOnlyResourceGroups.some(
      (g) => normalizeGroupKey(g) === normalizedGroup
    ) &&
    input.method !== 'GET'
  ) {
    return {
      ok: false,
      message: `The ${group} resource group is configured as read-only for this attachment.`,
    }
  }
  if (config.readOnly && input.method !== 'GET') {
    return {
      ok: false,
      message: 'This attachment is read-only. Use GET requests only.',
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
  toRequest({ config, input }) {
    const normalizedPath = normalizePosthogPath(input.path)
    const url = resolvePosthogUrl(normalizedPath, config.region)
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
      path: getCanonicalPosthogPathAndQuery(
        normalizePosthogPath(input.path),
        config.region
      ),
      method: input.method,
      readOnly: config.readOnly,
      region: config.region,
      body: parseProviderResponseFromHttp(response),
      truncated: response.truncated,
    })
  },
})
