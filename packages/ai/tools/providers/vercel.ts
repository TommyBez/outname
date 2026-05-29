import 'server-only'
import {
  buildResourceConfigShape,
  enforceResourceAccess,
  findResourceDefinition,
  type RestResourceDefinition,
} from '@outname/ai/tools/providers/rest-resource-groups'
import {
  defineApiPassthroughTool,
  type ToolPolicy,
  toolSuccess,
} from '@outname/ai/tools/runtime/define-maintainer-tool'
import {
  parseProviderResponseFromHttp,
  toolErrorFromProviderResponse,
} from '@outname/ai/tools/runtime/define-maintainer-tool/provider-response'
import { z } from 'zod'

const VERCEL_API_BASE = 'https://api.vercel.com'
const ABSOLUTE_URL_PATTERN = /^[a-z][a-z\d+.-]*:/i
const RESOURCE_LABEL_SEPARATOR_PATTERN = /[_-]+/

const VERCEL_RESOURCE_KEYS = [
  'access-groups',
  'aliases',
  'artifacts',
  'billing',
  'bulk-redirects',
  'certs',
  'connect',
  'deployments',
  'domains',
  'drains',
  'edge-cache',
  'edge-config',
  'env',
  'events',
  'files',
  'installations',
  'integrations',
  'log-drains',
  'messages',
  'microfrontends',
  'models',
  'observability',
  'products',
  'projects',
  'registrar',
  'sandboxes',
  'security',
  'storage',
  'teams',
  'user',
  'webhooks',
] as const

function toVercelLabel(key: string): string {
  return key
    .split(RESOURCE_LABEL_SEPARATOR_PATTERN)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(' ')
}

const VERCEL_RESOURCES = VERCEL_RESOURCE_KEYS.map((key) => ({
  key,
  label: toVercelLabel(key),
})) as readonly RestResourceDefinition[]

const vercelMethodSchema = z.enum(['GET', 'POST', 'PATCH', 'PUT', 'DELETE'])

const vercelConfigSchema = z.object({
  readOnly: z
    .boolean()
    .default(true)
    .describe('When true, only read operations are allowed for all groups.'),
  ...buildResourceConfigShape(VERCEL_RESOURCES),
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

function normalizedVercelPathname(path: string): string {
  return new URL(normalizeVercelPath(path), VERCEL_API_BASE).pathname
}

function vercelResourceKey(pathname: string): string | null {
  const parts = pathname.split('/').filter(Boolean)
  if (!parts[0]?.startsWith('v')) {
    return null
  }
  const resourceKey = parts[1]
  if (!resourceKey) {
    return null
  }
  return findResourceDefinition(VERCEL_RESOURCES, resourceKey)?.key ?? null
}

const vercelSafetyPolicy: ToolPolicy<VercelRequestInput, VercelConfig> = ({
  config,
  input,
}) => {
  if (input.method === 'GET' && input.body !== undefined) {
    return { ok: false, message: 'GET requests cannot include a body.' }
  }
  let normalizedPath: string
  let pathname: string
  try {
    normalizedPath = normalizeVercelPath(input.path)
    pathname = normalizedVercelPathname(input.path)
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'Invalid path.',
    }
  }

  const resourceKey = vercelResourceKey(pathname)
  if (!resourceKey) {
    return {
      ok: false,
      message: `Path "${normalizedPath}" is outside the declared Vercel REST surface.`,
    }
  }
  const resource = findResourceDefinition(VERCEL_RESOURCES, resourceKey)
  if (!resource) {
    return {
      ok: false,
      message: `Path "${normalizedPath}" does not map to a declared Vercel resource.`,
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

export const vercelRequestTool = defineApiPassthroughTool({
  id: 'vercel_request',
  category: 'deployment',
  displayName: 'Vercel · Request',
  displayDescription:
    'Manage Vercel projects, deployments, domains, and account settings.',
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
