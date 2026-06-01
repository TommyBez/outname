import type { AgentScheduleMode } from '@outname/shared/agent-schedule'
import {
  formatAgentSchedule,
  formatAgentScheduleInline,
} from '@outname/shared/agents/format'
import {
  formatAccountTimezoneLabel,
  formatCompactDateTimeInTimeZone,
  formatDateTimeInTimeZone,
  formatLongDateInTimeZone,
  formatMediumDateTimeInTimeZone,
  formatRelativeInTimeZone,
  formatTimeInTimeZone,
} from '@outname/shared/format-timezone'

export interface UserTimeDisplay {
  agentSchedule: (input: {
    enabled: boolean
    intervalMinutes: number
    mode: AgentScheduleMode
    times: readonly string[] | null | undefined
  }) => string
  agentScheduleInline: (input: {
    enabled: boolean
    intervalMinutes: number
    mode: AgentScheduleMode
    times: readonly string[] | null | undefined
  }) => string
  compactDateTime: (date: Date | string | null | undefined) => string
  dateTime: (date: Date | string | null | undefined) => string
  longDate: (date: Date | string | null | undefined) => string
  mediumDateTime: (date: Date | string | null | undefined) => string
  nullableDateTime: (
    date: Date | string | null | undefined,
    emptyLabel?: string
  ) => string
  relative: (date: Date | string | null | undefined) => string
  time: (
    date: Date | string | null | undefined,
    options?: { includeSeconds?: boolean }
  ) => string
  timeZone: string
  timezoneLabel: string
}

export function createUserTimeDisplay(timeZone: string): UserTimeDisplay {
  return {
    timeZone,
    timezoneLabel: formatAccountTimezoneLabel(timeZone),
    dateTime: (date) => formatDateTimeInTimeZone(date, timeZone),
    mediumDateTime: (date) => formatMediumDateTimeInTimeZone(date, timeZone),
    compactDateTime: (date) => formatCompactDateTimeInTimeZone(date, timeZone),
    nullableDateTime: (date, emptyLabel = 'Never') =>
      date ? formatMediumDateTimeInTimeZone(date, timeZone) : emptyLabel,
    time: (date, options) => formatTimeInTimeZone(date, timeZone, options),
    longDate: (date) => formatLongDateInTimeZone(date, timeZone),
    relative: (date) => formatRelativeInTimeZone(date, timeZone),
    agentSchedule: (input) => formatAgentSchedule({ ...input, timeZone }),
    agentScheduleInline: (input) =>
      formatAgentScheduleInline({ ...input, timeZone }),
  }
}
