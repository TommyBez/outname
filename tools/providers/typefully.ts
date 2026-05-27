import 'server-only'
import { z } from 'zod'
import { isTypefullyPresignedUploadRequest } from '@/shared/server/typefully-upload-url'
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

const TYPEFULLY_API_BASE = 'https://api.typefully.com'
const TYPEFULLY_MAX_RESPONSE_BYTES = 64 * 1024
const TYPEFULLY_DEFAULT_RESPONSE_BYTES = 16_000
const ABSOLUTE_URL_PATTERN = /^[a-z][a-z\d+.-]*:/i

const TYPEFULLY_ENDPOINT_GUIDE =
  'Use relative Typefully API v2 paths such as /v2/me, /v2/social-sets, /v2/social-sets/{social_set_id}/drafts, /v2/social-sets/{social_set_id}/analytics/{platform}/followers, /v2/social-sets/{social_set_id}/linkedin/organizations/resolve, /v2/social-sets/{social_set_id}/queue, /v2/social-sets/{social_set_id}/tags, and /v2/social-sets/{social_set_id}/media/upload. For media uploads, PUT to the presigned HTTPS upload_url returned by /v2/social-sets/{social_set_id}/media/upload.'

const TYPEFULLY_RESOURCES = [
  {
    key: 'openapi',
    label: 'OpenAPI',
    enableDescription: 'Enable the /v2/openapi.json metadata endpoint.',
    readOnlyDescription:
      'When true, the /v2/openapi.json metadata endpoint is read-only.',
    defaultReadOnly: true,
  },
  { key: 'me', label: 'Me', defaultReadOnly: false },
  { key: 'social-sets', label: 'Social Sets', defaultReadOnly: false },
  { key: 'analytics', label: 'Analytics', defaultReadOnly: false },
  { key: 'drafts', label: 'Drafts', defaultReadOnly: false },
  { key: 'linkedin', label: 'LinkedIn', defaultReadOnly: false },
  { key: 'media', label: 'Media', defaultReadOnly: false },
  { key: 'queue', label: 'Queue', defaultReadOnly: false },
  { key: 'tags', label: 'Tags', defaultReadOnly: false },
] as const satisfies readonly RestResourceDefinition[]

const typefullyMethodSchema = z.enum(['GET', 'POST', 'PATCH', 'PUT', 'DELETE'])
const typefullyConfigSchema = z.object({
  readOnly: z
    .boolean()
    .default(false)
    .describe('When true, only read operations are allowed across groups.'),
  ...buildResourceConfigShape(TYPEFULLY_RESOURCES),
})
const typefullyQueryValueSchema = z.union([z.string(), z.number(), z.boolean()])

const typefullyRequestInputSchema = z.object({
  method: typefullyMethodSchema.default('GET').describe('HTTP method to use.'),
  path: z
    .string()
    .min(1)
    .describe(
      `Relative Typefully path or Typefully media upload_url. ${TYPEFULLY_ENDPOINT_GUIDE}`
    ),
  query: z
    .record(z.string(), typefullyQueryValueSchema)
    .optional()
    .describe('Optional query string parameters.'),
  body: z
    .record(z.string(), z.unknown())
    .optional()
    .describe('Optional JSON body for non-GET requests.'),
  maxResponseBytes: z
    .number()
    .int()
    .min(1000)
    .max(TYPEFULLY_MAX_RESPONSE_BYTES)
    .default(TYPEFULLY_DEFAULT_RESPONSE_BYTES)
    .describe('Maximum response bytes to return, from 1000 to 65536.'),
})

type TypefullyHttpMethod = z.infer<typeof typefullyMethodSchema>
type TypefullyRequestInput = z.infer<typeof typefullyRequestInputSchema>
type TypefullyConfig = z.infer<typeof typefullyConfigSchema>

function normalizeTypefullyTarget(path: string): string {
  const trimmed = path.trim()
  if (trimmed.includes('\n') || trimmed.includes('\r')) {
    throw new Error('Path must be a single line.')
  }
  return trimmed
}

function normalizeTypefullyPath(path: string): string {
  const trimmed = normalizeTypefullyTarget(path)
  if (ABSOLUTE_URL_PATTERN.test(trimmed) || trimmed.startsWith('//')) {
    throw new Error(
      'Path must be relative to api.typefully.com unless it is a Typefully media upload_url.'
    )
  }
  if (!trimmed.startsWith('/')) {
    throw new Error('Path must start with "/".')
  }
  return trimmed
}

function parseAbsoluteTypefullyUrl(path: string): URL | null {
  const trimmed = normalizeTypefullyTarget(path)
  if (trimmed.startsWith('//')) {
    throw new Error('Protocol-relative URLs are not supported.')
  }
  if (!ABSOLUTE_URL_PATTERN.test(trimmed)) {
    return null
  }
  try {
    return new URL(trimmed)
  } catch {
    throw new Error('Typefully media upload_url is invalid.')
  }
}

function normalizedPathname(path: string): string {
  return new URL(normalizeTypefullyPath(path), TYPEFULLY_API_BASE).pathname
}

function typefullyRequestUrl(path: string, method: TypefullyHttpMethod): URL {
  const uploadUrl = parseAbsoluteTypefullyUrl(path)
  if (uploadUrl) {
    if (!isTypefullyPresignedUploadRequest({ method, url: uploadUrl })) {
      throw new Error(
        'Absolute URLs are only allowed for Typefully presigned S3 media upload PUT requests.'
      )
    }
    return uploadUrl
  }
  return new URL(normalizeTypefullyPath(path), TYPEFULLY_API_BASE)
}

function typefullyResourceKey(
  pathname: string,
  isUploadUrl: boolean
): string | null {
  if (isUploadUrl) {
    return 'media'
  }
  if (pathname === '/v2/openapi.json') {
    return 'openapi'
  }
  const parts = pathname.split('/').filter(Boolean)
  if (parts[0] !== 'v2') {
    return null
  }
  if (parts[1] === 'me') {
    return 'me'
  }
  if (parts[1] === 'social-sets') {
    if (parts.length <= 3) {
      return 'social-sets'
    }
    const nestedResource = parts[3]
    return (
      findResourceDefinition(TYPEFULLY_RESOURCES, nestedResource)?.key ?? null
    )
  }
  return (
    findResourceDefinition(TYPEFULLY_RESOURCES, parts[1] ?? '')?.key ?? null
  )
}

const typefullySafetyPolicy: ToolPolicy<
  TypefullyRequestInput,
  TypefullyConfig
> = ({ config, input }) => {
  if (input.method === 'GET' && input.body !== undefined) {
    return { ok: false, message: 'GET requests cannot include a body.' }
  }

  let pathname: string
  let isUploadUrl = false
  try {
    const uploadUrl = parseAbsoluteTypefullyUrl(input.path)
    if (uploadUrl) {
      if (
        !isTypefullyPresignedUploadRequest({
          method: input.method,
          url: uploadUrl,
        })
      ) {
        return {
          ok: false,
          message:
            'Absolute URLs are only allowed for Typefully presigned S3 media upload PUT requests.',
        }
      }
      if (input.query !== undefined) {
        return {
          ok: false,
          message:
            'Presigned media upload URLs already include signed query parameters.',
        }
      }
      pathname = uploadUrl.pathname
      isUploadUrl = true
    } else {
      pathname = normalizedPathname(input.path)
    }
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Invalid path.',
    }
  }

  const resourceKey = typefullyResourceKey(pathname, isUploadUrl)
  if (!resourceKey) {
    return {
      ok: false,
      message: `Path "${pathname}" is outside the allowed Typefully API v2 surface.`,
    }
  }
  const resource = findResourceDefinition(TYPEFULLY_RESOURCES, resourceKey)
  if (!resource) {
    return {
      ok: false,
      message: `Path "${pathname}" does not map to a declared Typefully resource.`,
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

function appendQueryParams(
  url: URL,
  query: Record<string, string | number | boolean> | undefined
): void {
  for (const [key, value] of Object.entries(query ?? {})) {
    url.searchParams.append(key, String(value))
  }
}

export const typefullyRequestTool = defineApiPassthroughTool({
  id: 'typefully_request',
  category: 'social',
  displayName: 'Typefully · Request',
  displayDescription:
    'Draft, schedule, and publish social posts with Typefully.',
  description:
    'Call authenticated Typefully API v2 endpoints for drafts, social sets, media, tags, scheduling, and publishing workflows.',
  connectorId: 'typefully.api_key',
  configSchema: typefullyConfigSchema,
  inputSchema: typefullyRequestInputSchema,
  policies: [typefullySafetyPolicy],
  toRequest({ input }) {
    const url = typefullyRequestUrl(input.path, input.method)
    appendQueryParams(url, input.query)

    const headers: Record<string, string> = {}
    const isUploadUrl = parseAbsoluteTypefullyUrl(input.path) !== null
    if (input.body !== undefined && !isUploadUrl) {
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
        label: 'Typefully request',
      })
    }

    return toolSuccess({
      status: response.status,
      normalizedPath: parseAbsoluteTypefullyUrl(input.path)
        ? '<typefully-media-upload-url>'
        : normalizeTypefullyPath(input.path),
      body: parseProviderResponseFromHttp(response),
      truncated: response.truncated,
    })
  },
})
