import 'server-only'
import { z } from 'zod'
import {
  defineApiPassthroughTool,
  type ToolPolicy,
  toolSuccess,
} from '@/tools/runtime/define-maintainer-tool'
import {
  parseProviderResponseFromHttp,
  toolErrorFromProviderResponse,
} from '@/tools/runtime/define-maintainer-tool/provider-response'

const CALCOM_API_BASE = 'https://api.cal.com/v2'
const CALCOM_API_VERSION = '2024-08-13'
const CALCOM_BOOKINGS_API_VERSION = '2026-02-25'
const CALCOM_EVENT_TYPES_API_VERSION = '2024-06-14'
const CALCOM_SCHEDULES_API_VERSION = '2024-06-11'
const CALCOM_SLOTS_API_VERSION = '2024-09-04'
const ABSOLUTE_URL_PATTERN = /^[a-z][a-z\d+.-]*:/i

const calcomMethodSchema = z.enum(['GET', 'POST', 'PATCH', 'PUT', 'DELETE'])

const CALCOM_ENDPOINT_GUIDE =
  'Allowed Cal.com API v2 paths: /me, /event-types, /bookings, /bookings/{uid}/cancel, /bookings/{uid}/reschedule, /slots, /schedules, /webhooks, /teams.'

const calcomConfigSchema = z.object({
  readOnly: z
    .boolean()
    .default(true)
    .describe(
      'When true, only GET requests are allowed. Set false to allow POST, PATCH, PUT, and DELETE on allowlisted paths.'
    ),
})

const calcomRequestInputSchema = z.object({
  method: calcomMethodSchema.describe('HTTP method to use.'),
  path: z
    .string()
    .min(1)
    .describe(`Relative Cal.com API v2 path. ${CALCOM_ENDPOINT_GUIDE}`),
  query: z
    .record(z.string(), z.string())
    .optional()
    .describe('Optional query parameters appended as strings.'),
  body: z
    .record(z.string(), z.unknown())
    .optional()
    .describe('Optional JSON request body for non-GET requests.'),
})

type CalcomHttpMethod = z.infer<typeof calcomMethodSchema>
type CalcomRequestInput = z.infer<typeof calcomRequestInputSchema>
type CalcomConfig = z.infer<typeof calcomConfigSchema>

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

const calcomSafetyPolicy: ToolPolicy<CalcomRequestInput, CalcomConfig> = ({
  config,
  input,
}) => {
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
  return { ok: true }
}

export const calcomRequestTool = defineApiPassthroughTool({
  id: 'calcom_request',
  category: 'scheduling',
  displayName: 'Cal.com · Request',
  description: `Call authenticated Cal.com API v2 endpoints for scheduling, bookings, event types, availability, and related resources. ${CALCOM_ENDPOINT_GUIDE}`,
  connectorId: 'calcom.api_key',
  configSchema: calcomConfigSchema,
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
      return toolErrorFromProviderResponse(response, {
        label: 'Cal.com request',
      })
    }
    const normalizedPath = normalizeCalcomPath(input.path)
    return toolSuccess({
      status: response.status,
      apiVersionUsed: defaultCalcomApiVersion(input.path, input.method),
      normalizedPath,
      body: parseProviderResponseFromHttp(response),
      truncated: response.truncated,
    })
  },
})
