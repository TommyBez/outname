import 'server-only'
import { tool } from 'ai'
import { z } from 'zod'
import { calcomApiKey } from '@/connectors/calcom'
import type { MaintainerTool } from './types'

const CALCOM_API_BASE = 'https://api.cal.com/v2'
const CALCOM_API_VERSION = '2024-08-13'
const CALCOM_BOOKINGS_API_VERSION = '2026-02-25'
const CALCOM_EVENT_TYPES_API_VERSION = '2024-06-14'
const CALCOM_SCHEDULES_API_VERSION = '2024-06-11'
const CALCOM_SLOTS_API_VERSION = '2024-09-04'
const MAX_RESPONSE_TEXT_LENGTH = 12_000
const ABSOLUTE_URL_PATTERN = /^[a-z][a-z\d+.-]*:/i

const calcomMethodSchema = z.enum(['GET', 'POST', 'PATCH', 'PUT', 'DELETE'])

const CALCOM_ENDPOINT_GUIDE =
  'Documented Cal.com API v2 examples: GET /me for the current user; GET /event-types to list event types; POST /event-types to create one; PATCH /event-types/{id} to update one; GET /bookings to list bookings; POST /bookings to create a booking; POST /bookings/{uid}/cancel to cancel; POST /bookings/{uid}/reschedule to reschedule; GET /slots with eventTypeId, start, and end query params to check slots; GET /schedules and POST /schedules for schedules; GET /webhooks and POST /webhooks for webhooks; GET /teams to list teams. The tool chooses documented endpoint-specific cal-api-version values internally: bookings use 2026-02-25, event-types use 2024-06-14, schedules use 2024-06-11, slots use 2024-09-04, and other endpoints use 2024-08-13. Use v2 request bodies: bookings use attendee, not responses; event types use lengthInMinutes; webhook create uses triggers.'

const calcomRequestInputSchema = z.object({
  method: calcomMethodSchema.describe('HTTP method to use.'),
  path: z
    .string()
    .min(1)
    .describe(
      `Cal.com API v2 path under https://api.cal.com/v2. ${CALCOM_ENDPOINT_GUIDE}`
    ),
  query: z
    .record(z.string())
    .optional()
    .describe(
      'Optional query parameters. Values are appended as strings. For /slots, Cal.com documents start and end plus either eventTypeId, eventTypeSlug with username or teamSlug, or usernames for dynamic availability.'
    ),
  body: z
    .record(z.unknown())
    .optional()
    .describe(
      'Optional JSON request body for non-GET requests. Cal.com v2 examples include booking bodies with eventTypeId, start, attendee, location, and metadata; event type bodies with title, slug, lengthInMinutes, and locations; webhook bodies with subscriberUrl, triggers, active, and optional payloadTemplate.'
    ),
})

type CalcomHttpMethod = z.infer<typeof calcomMethodSchema>

interface ExecuteCalcomRequestArgs {
  apiKey: string
  apiVersion: string
  body?: Record<string, unknown>
  method: CalcomHttpMethod
  path: string
  query?: Record<string, string>
  toolId: string
}

function normalizeCalcomPath(path: string, toolId: string): string {
  const trimmed = path.trim()
  if (ABSOLUTE_URL_PATTERN.test(trimmed) || trimmed.startsWith('//')) {
    throw new Error(`${toolId}: path must be a relative Cal.com API path.`)
  }
  if (!trimmed.startsWith('/')) {
    throw new Error(`${toolId}: path must start with "/".`)
  }
  if (trimmed.includes('\n') || trimmed.includes('\r')) {
    throw new Error(`${toolId}: path must be a single line.`)
  }
  if (trimmed === '/v2') {
    return '/'
  }
  if (trimmed.startsWith('/v2/')) {
    return trimmed.slice(3)
  }
  return trimmed
}

function normalizedCalcomPathname(path: string, toolId: string): string {
  const normalized = normalizeCalcomPath(path, toolId)
  return new URL(normalized, CALCOM_API_BASE).pathname
}

function defaultCalcomApiVersion(
  path: string,
  method: CalcomHttpMethod,
  toolId: string
): string {
  const normalized = normalizedCalcomPathname(path, toolId)
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

function clippedText(text: string): { text: string; truncated: boolean } {
  if (text.length <= MAX_RESPONSE_TEXT_LENGTH) {
    return { text, truncated: false }
  }
  return {
    text: text.slice(0, MAX_RESPONSE_TEXT_LENGTH),
    truncated: true,
  }
}

function parseResponseBody(raw: string, contentType: string | null) {
  const clipped = clippedText(raw)
  if (raw.length === 0) {
    return { body: null, truncated: false }
  }
  if (clipped.truncated) {
    return { body: clipped.text, truncated: true }
  }
  if (contentType?.includes('application/json')) {
    try {
      return { body: JSON.parse(raw) as unknown, truncated: false }
    } catch {
      return { body: raw, truncated: false }
    }
  }
  return { body: raw, truncated: false }
}

async function executeCalcomRequest(args: ExecuteCalcomRequestArgs) {
  'use step'
  if (args.method === 'GET' && args.body !== undefined) {
    throw new Error(`${args.toolId}: GET requests cannot include a body.`)
  }

  const path = normalizeCalcomPath(args.path, args.toolId)
  const url = new URL(`${CALCOM_API_BASE}${path}`)
  for (const [key, value] of Object.entries(args.query ?? {})) {
    url.searchParams.append(key, value)
  }

  const res = await fetch(url, {
    method: args.method,
    headers: {
      authorization: `Bearer ${args.apiKey}`,
      'cal-api-version': args.apiVersion,
      'content-type': 'application/json',
    },
    body: args.body === undefined ? undefined : JSON.stringify(args.body),
  })
  const raw = await res.text()
  const parsed = parseResponseBody(raw, res.headers.get('content-type'))

  return {
    ok: res.ok,
    status: res.status,
    apiVersionUsed: args.apiVersion,
    normalizedPath: path,
    body: parsed.body,
    truncated: parsed.truncated,
  }
}

export const calcomRequestTool: MaintainerTool = {
  id: 'calcom_request',
  category: 'scheduling',
  displayName: 'Cal.com · Request',
  description:
    'Call authenticated Cal.com API v2 endpoints for scheduling, bookings, event types, availability, and related resources.',
  requirements: [{ kind: 'connection', provider: 'calcom' }],
  build({ credentials, toolId }) {
    return tool({
      description: `Call a Cal.com API v2 endpoint using the connected API key. Use relative paths only. ${CALCOM_ENDPOINT_GUIDE}`,
      inputSchema: calcomRequestInputSchema,
      async execute({ method, path, query, body }) {
        const apiKey = calcomApiKey(credentials.calcom)
        return await executeCalcomRequest({
          apiKey,
          apiVersion: defaultCalcomApiVersion(path, method, toolId),
          body,
          method,
          path,
          query,
          toolId,
        })
      },
    })
  },
}
