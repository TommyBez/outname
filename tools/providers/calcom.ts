import 'server-only'
import { z } from 'zod'
import {
  defineApiPassthroughTool,
  type ToolPolicy,
  toolError,
  toolSuccess,
} from '@/tools/runtime/define-maintainer-tool'

const CALCOM_API_BASE = 'https://api.cal.com/v2'
const CALCOM_API_VERSION = '2024-08-13'
const CALCOM_BOOKINGS_API_VERSION = '2026-02-25'
const CALCOM_EVENT_TYPES_API_VERSION = '2024-06-14'
const CALCOM_SCHEDULES_API_VERSION = '2024-06-11'
const CALCOM_SLOTS_API_VERSION = '2024-09-04'
const ABSOLUTE_URL_PATTERN = /^[a-z][a-z\d+.-]*:/i

const calcomMethodSchema = z.enum(['GET', 'POST', 'PATCH', 'PUT', 'DELETE'])

const CALCOM_ENDPOINT_GUIDE =
  'Allowed Cal.com API v2 paths: /me, /event-types, /bookings, /bookings/{uid}/cancel, /bookings/{uid}/reschedule, /slots, /schedules, /webhooks, /teams. Destructive or booking-mutating calls require confirmIrreversible=true.'
const PROVIDER_ERROR_BODY_LIMIT = 1000

const calcomRequestInputSchema = z.object({
  method: calcomMethodSchema.describe('HTTP method to use. DELETE is denied.'),
  path: z
    .string()
    .min(1)
    .describe(`Relative Cal.com API v2 path. ${CALCOM_ENDPOINT_GUIDE}`),
  query: z
    .record(z.string())
    .optional()
    .describe('Optional query parameters appended as strings.'),
  body: z
    .record(z.unknown())
    .optional()
    .describe('Optional JSON request body for non-GET requests.'),
  confirmIrreversible: z
    .boolean()
    .default(false)
    .describe(
      'Set true only for booking-mutating calls such as create, cancel, or reschedule.'
    ),
})

type CalcomHttpMethod = z.infer<typeof calcomMethodSchema>
type CalcomRequestInput = z.infer<typeof calcomRequestInputSchema>

function normalizeCalcomPath(path: string): string {
  const trimmed = path.trim()
  if (ABSOLUTE_URL_PATTERN.test(trimmed) || trimmed.startsWith('//')) {
    throw new Error('Path must be a relative Cal.com API path.')
  }
  if (!trimmed.startsWith('/')) {
    throw new Error('Path must start with "/".')
  }
  if (trimmed.includes('\n') || trimmed.includes('\r')) {
    throw new Error('Path must be a single line.')
  }
  if (trimmed === '/v2') {
    return '/'
  }
  if (trimmed.startsWith('/v2/')) {
    return trimmed.slice(3)
  }
  return trimmed
}

function normalizedCalcomPathname(path: string): string {
  return new URL(normalizeCalcomPath(path), CALCOM_API_BASE).pathname
}

function defaultCalcomApiVersion(
  path: string,
  method: CalcomHttpMethod
): string {
  const normalized = normalizedCalcomPathname(path)
  if (normalized === '/bookings' || normalized.startsWith('/bookings/')) {
    return CALCOM_BOOKINGS_API_VERSION
  }
  if (normalized === '/event-types' || normalized.startsWith('/event-types/')) {
    return CALCOM_EVENT_TYPES_API_VERSION
  }
  if (normalized === '/schedules' || normalized.startsWith('/schedules/')) {
    return CALCOM_SCHEDULES_API_VERSION
  }
  if (normalized === '/slots' || normalized.startsWith('/slots/')) {
    return CALCOM_SLOTS_API_VERSION
  }
  if (method === 'GET' && normalized === '/teams') {
    return CALCOM_API_VERSION
  }
  return CALCOM_API_VERSION
}

function isAllowedPath(pathname: string): boolean {
  return (
    pathname === '/me' ||
    pathname === '/event-types' ||
    pathname.startsWith('/event-types/') ||
    pathname === '/bookings' ||
    pathname.startsWith('/bookings/') ||
    pathname === '/slots' ||
    pathname === '/schedules' ||
    pathname.startsWith('/schedules/') ||
    pathname === '/webhooks' ||
    pathname.startsWith('/webhooks/') ||
    pathname === '/teams'
  )
}

function isIrreversible(input: CalcomRequestInput): boolean {
  const pathname = normalizedCalcomPathname(input.path)
  if (input.method === 'DELETE') {
    return true
  }
  if (input.method === 'POST' && pathname === '/bookings') {
    return true
  }
  return (
    input.method === 'POST' &&
    (pathname.endsWith('/cancel') || pathname.endsWith('/reschedule'))
  )
}

const calcomSafetyPolicy: ToolPolicy<
  CalcomRequestInput,
  Record<string, never>
> = ({ input }) => {
  if (input.method === 'DELETE') {
    return { ok: false, message: 'DELETE requests are not allowed.' }
  }
  if (input.method === 'GET' && input.body !== undefined) {
    return { ok: false, message: 'GET requests cannot include a body.' }
  }
  let pathname: string
  try {
    pathname = normalizedCalcomPathname(input.path)
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'Invalid path.',
    }
  }
  if (!isAllowedPath(pathname)) {
    return {
      ok: false,
      message: `Path "${pathname}" is outside the allowed Cal.com surface.`,
    }
  }
  if (isIrreversible(input) && !input.confirmIrreversible) {
    return {
      ok: false,
      message:
        'This Cal.com call can change bookings and requires confirmIrreversible=true.',
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
    return `Cal.com request failed (HTTP ${response.status}).`
  }
  const truncated =
    response.truncated || body.length > PROVIDER_ERROR_BODY_LIMIT
  const suffix = truncated ? ' [truncated]' : ''
  return `Cal.com request failed (HTTP ${response.status}): ${body.slice(0, PROVIDER_ERROR_BODY_LIMIT)}${suffix}`
}

export const calcomRequestTool = defineApiPassthroughTool({
  id: 'calcom_request',
  category: 'scheduling',
  displayName: 'Cal.com · Request',
  description: `Call authenticated Cal.com API v2 endpoints for scheduling, bookings, event types, availability, and related resources. ${CALCOM_ENDPOINT_GUIDE}`,
  provider: 'calcom',
  inputSchema: calcomRequestInputSchema,
  policies: [calcomSafetyPolicy],
  toRequest({ input }) {
    const path = normalizeCalcomPath(input.path)
    const url = new URL(`${CALCOM_API_BASE}${path}`)
    for (const [key, value] of Object.entries(input.query ?? {})) {
      url.searchParams.append(key, value)
    }
    return {
      method: input.method,
      url: url.toString(),
      headers: {
        'cal-api-version': defaultCalcomApiVersion(input.path, input.method),
        'content-type': 'application/json',
      },
      body: input.body,
    }
  },
  handleResponse(response, { input }) {
    if (!response.ok) {
      return toolError('provider_error', clippedProviderError(response))
    }
    const normalizedPath = normalizeCalcomPath(input.path)
    return toolSuccess({
      status: response.status,
      apiVersionUsed: defaultCalcomApiVersion(input.path, input.method),
      normalizedPath,
      body: parseResponseBody(
        response.bodyText,
        response.headers['content-type']
      ),
      truncated: response.truncated,
    })
  },
})
