import {
  type AgentScheduleMode,
  normalizeAgentScheduleMode,
  normalizeDailyScheduleTimes,
} from '@outname/shared/agent-schedule'
import { formatScheduleTimezoneSuffix } from '@outname/shared/format-timezone'

const MINUTES_PER_HOUR = 60
const MINUTES_PER_DAY = MINUTES_PER_HOUR * 24

type MinuteUnitStyle = 'long' | 'short'

function formatAgentInterval(minutes: number): string {
  return formatMinuteDuration(minutes, { minuteUnitStyle: 'short' })
}

export function formatAgentCadence(minutes: number): string {
  const totalMinutes = normalizeMinutes(minutes)
  if (totalMinutes === 1) {
    return 'Every minute'
  }
  if (totalMinutes === MINUTES_PER_HOUR) {
    return 'Every hour'
  }
  if (totalMinutes === MINUTES_PER_DAY) {
    return 'Every day'
  }
  return `Every ${formatMinuteDuration(totalMinutes, {
    minuteUnitStyle: 'long',
  })}`
}

export function formatAgentSchedule(input: {
  enabled: boolean
  intervalMinutes: number
  mode: AgentScheduleMode
  timeZone?: string
  times: readonly string[] | null | undefined
}): string {
  if (!input.enabled) {
    return 'Off'
  }
  if (normalizeAgentScheduleMode(input.mode) === 'daily_times') {
    const times = normalizeDailyScheduleTimes(input.times)
    const suffix = input.timeZone
      ? formatScheduleTimezoneSuffix(input.timeZone)
      : ''
    return times.length > 0 ? `At ${times.join(', ')}${suffix}` : 'No times set'
  }
  return formatAgentCadence(input.intervalMinutes)
}

export function formatAgentScheduleInline(input: {
  enabled: boolean
  intervalMinutes: number
  mode: AgentScheduleMode
  timeZone?: string
  times: readonly string[] | null | undefined
}): string {
  if (!input.enabled) {
    return 'off'
  }
  if (normalizeAgentScheduleMode(input.mode) === 'daily_times') {
    const times = normalizeDailyScheduleTimes(input.times)
    const suffix = input.timeZone
      ? formatScheduleTimezoneSuffix(input.timeZone)
      : ''
    return times.length > 0 ? `at ${times.join(', ')}${suffix}` : 'no times set'
  }
  return formatAgentInterval(input.intervalMinutes)
}

function formatMinuteDuration(
  minutes: number,
  {
    minuteUnitStyle,
  }: {
    minuteUnitStyle: MinuteUnitStyle
  }
): string {
  const totalMinutes = normalizeMinutes(minutes)
  const days = Math.floor(totalMinutes / MINUTES_PER_DAY)
  const hours = Math.floor((totalMinutes % MINUTES_PER_DAY) / MINUTES_PER_HOUR)
  const remainingMinutes = totalMinutes % MINUTES_PER_HOUR
  const parts: string[] = []

  if (days > 0) {
    parts.push(formatUnit(days, 'day', 'days'))
  }
  if (hours > 0) {
    parts.push(formatUnit(hours, 'hour', 'hours'))
  }
  if (remainingMinutes > 0 || parts.length === 0) {
    parts.push(formatMinutes(remainingMinutes, minuteUnitStyle))
  }

  return parts.join(' ')
}

function formatMinutes(value: number, style: MinuteUnitStyle): string {
  if (style === 'short') {
    return `${value} min`
  }
  return formatUnit(value, 'minute', 'minutes')
}

function formatUnit(value: number, singular: string, plural: string): string {
  return `${value} ${value === 1 ? singular : plural}`
}

function normalizeMinutes(minutes: number): number {
  return Math.max(0, Math.trunc(minutes))
}
