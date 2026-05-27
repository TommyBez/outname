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

const POSTHOG_API_BASE_BY_REGION = {
  eu: 'https://eu.posthog.com',
  us: 'https://us.posthog.com',
} as const
const ABSOLUTE_URL_PATTERN = /^[a-z][a-z\d+.-]*:/i
const RESOURCE_LABEL_SEPARATOR_PATTERN = /[_-]+/

const POSTHOG_RESOURCE_KEYS = [
  'project-root',
  'actions',
  'activity_log',
  'annotations',
  'app_metrics',
  'batch_exports',
  'cohorts',
  'dashboard_templates',
  'dashboards',
  'data_management',
  'early_access_feature',
  'event_definitions',
  'events',
  'experiments',
  'explicit_members',
  'exports',
  'external_data_sources',
  'feature_flags',
  'groups',
  'groups_types',
  'hooks',
  'ingestion_warnings',
  'insights',
  'integrations',
  'persons',
  'pipeline_transformations_configs',
  'plugin_configs',
  'property_definitions',
  'query',
  'search',
  'session_recording_playlists',
  'session_recordings',
  'subscriptions',
  'surveys',
  'tags',
  'uploaded_media',
  'warehouse_saved_queries',
  'warehouse_tables',
  'warehouse_view_link',
  'warehouse_view_links',
] as const

function toPosthogLabel(key: string): string {
  return key
    .split(RESOURCE_LABEL_SEPARATOR_PATTERN)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(' ')
}

const POSTHOG_RESOURCES = POSTHOG_RESOURCE_KEYS.map((key) => ({
  key,
  label: key === 'project-root' ? 'Project Root' : toPosthogLabel(key),
  enableDescription:
    key === 'project-root'
      ? 'Enable the project-root endpoint under /api/projects/{projectId}/.'
      : undefined,
  readOnlyDescription:
    key === 'project-root'
      ? 'When true, the project-root endpoint is read-only.'
      : undefined,
})) as readonly RestResourceDefinition[]

const posthogConfigSchema = z.object({
  region: z
    .enum(['us', 'eu'])
    .default('us')
    .describe(
      'PostHog server region for this workspace. Choose "us" for US Cloud or "eu" for EU Cloud.'
    ),
  projectId: z
    .string()
    .min(1)
    .describe('Allowed PostHog project ID for this tool attachment.'),
  readOnly: z
    .boolean()
    .default(true)
    .describe('When true, only GET requests are allowed. Recommended default.'),
  ...buildResourceConfigShape(POSTHOG_RESOURCES),
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

function posthogResourceKey(
  canonicalPathname: string,
  projectPrefix: string
): string | null {
  const rest = canonicalPathname.slice(projectPrefix.length)
  const firstSegment = rest.split('/').filter(Boolean)[0]
  if (!firstSegment) {
    return 'project-root'
  }
  return findResourceDefinition(POSTHOG_RESOURCES, firstSegment)?.key ?? null
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
  const resourceKey = posthogResourceKey(
    canonicalPathname,
    expectedProjectPrefix
  )
  if (!resourceKey) {
    return {
      ok: false,
      message: `Path "${canonicalPathname}" is outside the declared PostHog project resource surface.`,
    }
  }
  const resource = findResourceDefinition(POSTHOG_RESOURCES, resourceKey)
  if (!resource) {
    return {
      ok: false,
      message: `Path "${canonicalPathname}" does not map to a declared PostHog resource.`,
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

export const posthogRequestTool = defineApiPassthroughTool({
  id: 'posthog_request',
  category: 'analytics',
  displayName: 'PostHog · Request',
  displayDescription:
    'Query and manage PostHog analytics, flags, and project data.',
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
