import 'server-only'
import { z } from 'zod'
import { isTypefullyPresignedUploadRequest } from '@/shared/server/typefully-upload-url'
import {
  defineApiPassthroughTool,
  type ToolPolicy,
  toolError,
  toolSuccess,
} from '@/tools/runtime/define-maintainer-tool'

const TYPEFULLY_API_BASE = 'https://api.typefully.com'
const TYPEFULLY_MAX_RESPONSE_BYTES = 64 * 1024
const TYPEFULLY_DEFAULT_RESPONSE_BYTES = 16_000
const PROVIDER_ERROR_BODY_LIMIT = 1000
const ABSOLUTE_URL_PATTERN = /^[a-z][a-z\d+.-]*:/i

const TYPEFULLY_ENDPOINT_GUIDE =
  'Use relative Typefully API v2 paths such as /v2/me, /v2/social-sets/{social_set_id}/drafts, /v2/drafts/{id}, /v2/media, and /v2/tags. For media uploads, PUT to the presigned HTTPS upload_url returned by /v2/social-sets/{social_set_id}/media/upload. Mutating calls require confirmMutation=true.'

const typefullyMethodSchema = z.enum(['GET', 'POST', 'PATCH', 'PUT', 'DELETE'])
const typefullyConfigSchema = z.object({
  readOnly: z
    .boolean()
    .default(false)
    .describe(
      'When true, only read operations are allowed. Non-GET methods are blocked.'
    ),
})
const typefullyQueryValueSchema = z.union([z.string(), z.number(), z.boolean()])

const typefullyRequestInputSchema = z.object({
  method: typefullyMethodSchema
    .default('GET')
    .describe(
      'HTTP method to use. Non-GET methods require confirmMutation=true.'
    ),
  path: z
    .string()
    .min(1)
    .describe(
      `Relative Typefully path or Typefully media upload_url. ${TYPEFULLY_ENDPOINT_GUIDE}`
    ),
  query: z
    .record(typefullyQueryValueSchema)
    .optional()
    .describe('Optional query string parameters.'),
  body: z
    .record(z.unknown())
    .optional()
    .describe('Optional JSON body for non-GET requests.'),
  maxResponseBytes: z
    .number()
    .int()
    .min(1000)
    .max(TYPEFULLY_MAX_RESPONSE_BYTES)
    .default(TYPEFULLY_DEFAULT_RESPONSE_BYTES)
    .describe('Maximum response bytes to return, from 1000 to 65536.'),
  confirmMutation: z
    .boolean()
    .default(false)
    .describe(
      'Set true only when intentionally creating, updating, publishing, scheduling, or deleting content.'
    ),
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

function isAllowedPath(pathname: string): boolean {
  return pathname === '/v2/openapi.json' || pathname.startsWith('/v2/')
}

function isMutationMethod(method: TypefullyHttpMethod): boolean {
  return method !== 'GET'
}

const typefullySafetyPolicy: ToolPolicy<
  TypefullyRequestInput,
  TypefullyConfig
> = ({ config, input }) => {
  if (input.method === 'GET' && input.body !== undefined) {
    return { ok: false, message: 'GET requests cannot include a body.' }
  }
  if (config.readOnly && isMutationMethod(input.method)) {
    return {
      ok: false,
      message:
        'This tool attachment is configured as read-only. Only GET requests are allowed.',
    }
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

  if (!(isUploadUrl || isAllowedPath(pathname))) {
    return {
      ok: false,
      message: `Path "${pathname}" is outside the allowed Typefully API v2 surface.`,
    }
  }

  if (isMutationMethod(input.method) && !input.confirmMutation) {
    return {
      ok: false,
      message:
        'This Typefully API call can mutate state and requires confirmMutation=true.',
    }
  }

  return { ok: true }
}

function parseResponseBody(
  raw: string,
  contentType: string | undefined
): unknown {
  if (raw.length === 0) {
    return null
  }
  if (contentType?.includes('application/json')) {
    try {
      return JSON.parse(raw) as unknown
    } catch {
      return raw
    }
  }
  return raw
}

function clippedProviderError(response: {
  bodyText: string
  status: number
  truncated: boolean
}): string {
  const body = response.bodyText.trim()
  if (!body) {
    return `Typefully request failed (HTTP ${response.status}).`
  }
  const truncated =
    response.truncated || body.length > PROVIDER_ERROR_BODY_LIMIT
  const suffix = truncated ? ' [truncated]' : ''
  return `Typefully request failed (HTTP ${response.status}): ${body.slice(0, PROVIDER_ERROR_BODY_LIMIT)}${suffix}`
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
  description:
    'Call authenticated Typefully API v2 endpoints for drafts, social sets, media, tags, scheduling, and publishing workflows.',
  provider: 'typefully',
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
      return toolError('provider_error', clippedProviderError(response))
    }

    return toolSuccess({
      status: response.status,
      normalizedPath: parseAbsoluteTypefullyUrl(input.path)
        ? '<typefully-media-upload-url>'
        : normalizeTypefullyPath(input.path),
      body: parseResponseBody(
        response.bodyText,
        response.headers['content-type']
      ),
      truncated: response.truncated,
    })
  },
})
