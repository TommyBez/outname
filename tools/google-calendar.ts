import 'server-only'
import { tool } from 'ai'
import { z } from 'zod'
import { googleAccessToken } from '@/connectors/google'
import type { MaintainerTool } from './types'

/**
 * Google Calendar tools. Both read and create back onto the shared
 * `google` connection. The default calendar id is an attachment-config
 * field — same Google account can drive different agents pointing at
 * different calendars without re-authing.
 */

const CALENDAR_READONLY = 'https://www.googleapis.com/auth/calendar.readonly'
const CALENDAR_EVENTS = 'https://www.googleapis.com/auth/calendar.events'

const calendarConfigSchema = z.object({
  defaultCalendarId: z
    .string()
    .min(1)
    .default('primary')
    .describe(
      'Calendar id used by tool calls that don\'t pass an explicit `calendarId`. "primary" maps to the connected user\'s main calendar.'
    ),
})

interface CalendarEvent {
  id: string
  summary?: string
  description?: string
  location?: string
  start?: { dateTime?: string; date?: string; timeZone?: string }
  end?: { dateTime?: string; date?: string; timeZone?: string }
  attendees?: Array<{ email: string; responseStatus?: string }>
  hangoutLink?: string
  htmlLink?: string
  status?: string
}

interface EventListResponse {
  items?: CalendarEvent[]
  nextPageToken?: string
}

export const calendarReadTool: MaintainerTool = {
  id: 'gcal_read',
  category: 'calendar',
  displayName: 'Calendar · Read',
  description:
    'List upcoming events from the configured Google Calendar. Defaults to the next 7 days, capped at 25 events.',
  requirements: [{ kind: 'connection', provider: 'google', scopes: [CALENDAR_READONLY] }],
  configSchema: calendarConfigSchema,
  configFields: [
    {
      name: 'defaultCalendarId',
      label: 'Default calendar',
      description: 'Calendar id (e.g. "primary" or "team@example.com").',
      type: 'text',
      placeholder: 'primary',
      default: 'primary',
      required: true,
    },
  ],
  build({ credentials, config, toolId }) {
    const parsed = calendarConfigSchema.parse(config)
    return tool({
      description:
        'List upcoming events from the configured calendar. Returns id, title, start, end, location, attendees.',
      inputSchema: z.object({
        calendarId: z
          .string()
          .optional()
          .describe(
            'Override the default calendar id for this call. Falls back to the attachment default.'
          ),
        timeMin: z
          .string()
          .optional()
          .describe(
            'ISO-8601 lower bound for `start`. Defaults to "now"; pass a past date for a backwards window.'
          ),
        timeMax: z
          .string()
          .optional()
          .describe('ISO-8601 upper bound for `start`. Defaults to now+7d.'),
        maxResults: z
          .number()
          .int()
          .min(1)
          .max(25)
          .optional()
          .describe('Cap on returned events (default 10, max 25).'),
        q: z
          .string()
          .optional()
          .describe('Free-text search across event fields.'),
      }),
      async execute({ calendarId, timeMin, timeMax, maxResults, q }) {
        const token = googleAccessToken(credentials.google)
        const calId = calendarId ?? parsed.defaultCalendarId
        const now = new Date()
        const params = new URLSearchParams({
          timeMin: timeMin ?? now.toISOString(),
          timeMax:
            timeMax ??
            new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          singleEvents: 'true',
          orderBy: 'startTime',
          maxResults: String(maxResults ?? 10),
        })
        if (q) {
          params.set('q', q)
        }
        const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
          calId
        )}/events?${params.toString()}`
        const res = await fetch(url, {
          headers: { authorization: `Bearer ${token}` },
        })
        if (!res.ok) {
          const text = await res.text()
          return {
            ok: false as const,
            error: `${toolId}: list failed (HTTP ${res.status}) ${text.slice(0, 200)}`,
          }
        }
        const list = (await res.json()) as EventListResponse
        return {
          ok: true as const,
          calendarId: calId,
          events: (list.items ?? []).map((e) => ({
            id: e.id,
            title: e.summary ?? '(no title)',
            start: e.start?.dateTime ?? e.start?.date ?? null,
            end: e.end?.dateTime ?? e.end?.date ?? null,
            location: e.location ?? null,
            attendees: (e.attendees ?? []).map((a) => a.email),
            hangoutLink: e.hangoutLink ?? null,
            htmlLink: e.htmlLink ?? null,
            status: e.status ?? null,
          })),
        }
      },
    })
  },
}

export const calendarCreateTool: MaintainerTool = {
  id: 'gcal_create',
  category: 'calendar',
  displayName: 'Calendar · Create event',
  description:
    'Create a new event on the configured Google Calendar. Requires a title and start/end timestamps.',
  requirements: [{ kind: 'connection', provider: 'google', scopes: [CALENDAR_EVENTS] }],
  configSchema: calendarConfigSchema,
  configFields: [
    {
      name: 'defaultCalendarId',
      label: 'Default calendar',
      description: 'Calendar id (e.g. "primary" or "team@example.com").',
      type: 'text',
      placeholder: 'primary',
      default: 'primary',
      required: true,
    },
  ],
  build({ credentials, config, toolId }) {
    const parsed = calendarConfigSchema.parse(config)
    return tool({
      description:
        'Create a calendar event. Returns the new event id and html link on success.',
      inputSchema: z.object({
        calendarId: z
          .string()
          .optional()
          .describe(
            'Override the default calendar id for this call. Falls back to the attachment default.'
          ),
        summary: z.string().min(1).describe('Event title.'),
        description: z.string().optional(),
        location: z.string().optional(),
        start: z
          .string()
          .describe('Start in ISO-8601 (e.g. "2026-05-01T15:00:00-07:00").'),
        end: z.string().describe('End in ISO-8601.'),
        attendees: z.array(z.string().email()).optional(),
      }),
      async execute({
        calendarId,
        summary,
        description,
        location,
        start,
        end,
        attendees,
      }) {
        const token = googleAccessToken(credentials.google)
        const calId = calendarId ?? parsed.defaultCalendarId
        const body: Record<string, unknown> = {
          summary,
          description,
          location,
          start: { dateTime: start },
          end: { dateTime: end },
        }
        if (attendees && attendees.length > 0) {
          body.attendees = attendees.map((email) => ({ email }))
        }
        const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
          calId
        )}/events`
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            authorization: `Bearer ${token}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify(body),
        })
        if (!res.ok) {
          const text = await res.text()
          return {
            ok: false as const,
            error: `${toolId}: create failed (HTTP ${res.status}) ${text.slice(0, 200)}`,
          }
        }
        const created = (await res.json()) as CalendarEvent
        return {
          ok: true as const,
          id: created.id,
          htmlLink: created.htmlLink ?? null,
          calendarId: calId,
        }
      },
    })
  },
}
