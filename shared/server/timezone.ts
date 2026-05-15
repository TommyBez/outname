export const DEFAULT_TIMEZONE = 'UTC'

const LOCAL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/
const LOCAL_TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/

/**
 * Return a stable YYYY-MM-DD date for `date` in an IANA timezone.
 * Falls back to UTC if the stored timezone is invalid.
 */
export function localDateKey(date: Date, timezone?: string | null): string {
  const timeZone = safeTimeZone(timezone)
  try {
    return formatLocalDate(date, timeZone)
  } catch {
    return formatLocalDate(date, DEFAULT_TIMEZONE)
  }
}

export interface LocalDateTimeParts {
  date: string
  hour: number
  minute: number
  time: string
}

export function localDateTimeParts(
  date: Date,
  timezone?: string | null
): LocalDateTimeParts {
  return formatLocalDateTimeParts(date, safeTimeZone(timezone))
}

export function localDateTimeToUtc(input: {
  localDate: string
  time: string
  timezone?: string | null
}): Date | null {
  const target = parseLocalDateTime(input.localDate, input.time)
  if (!target) {
    return null
  }
  const timeZone = safeTimeZone(input.timezone)
  let instant = new Date(
    Date.UTC(
      target.year,
      target.month - 1,
      target.day,
      target.hour,
      target.minute
    )
  )

  for (let i = 0; i < 4; i += 1) {
    const actual = formatLocalDateTimeParts(instant, timeZone)
    const deltaMinutes =
      wallClockMinutes(target) - wallClockMinutes(localPartsToTarget(actual))
    if (deltaMinutes === 0) {
      break
    }
    instant = new Date(instant.getTime() + deltaMinutes * 60_000)
  }

  const verified = formatLocalDateTimeParts(instant, timeZone)
  return verified.date === input.localDate && verified.time === input.time
    ? instant
    : null
}

function formatLocalDate(date: Date, timeZone: string): string {
  return formatLocalDateTimeParts(date, timeZone).date
}

function formatLocalDateTimeParts(
  date: Date,
  timeZone: string
): LocalDateTimeParts {
  const parts = new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
    minute: '2-digit',
    month: '2-digit',
    timeZone,
    year: 'numeric',
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map((p) => [p.type, p.value]))
  const hour = Number.parseInt(values.hour ?? '0', 10)
  const minute = Number.parseInt(values.minute ?? '0', 10)
  return {
    date: `${values.year}-${values.month}-${values.day}`,
    hour,
    minute,
    time: `${pad2(hour)}:${pad2(minute)}`,
  }
}

function parseLocalDateTime(
  localDate: string,
  time: string
): LocalTarget | null {
  const dateMatch = LOCAL_DATE_PATTERN.exec(localDate)
  const timeMatch = LOCAL_TIME_PATTERN.exec(time)
  if (!(dateMatch && timeMatch)) {
    return null
  }
  return {
    day: Number.parseInt(dateMatch[3], 10),
    hour: Number.parseInt(timeMatch[1], 10),
    minute: Number.parseInt(timeMatch[2], 10),
    month: Number.parseInt(dateMatch[2], 10),
    year: Number.parseInt(dateMatch[1], 10),
  }
}

interface LocalTarget {
  day: number
  hour: number
  minute: number
  month: number
  year: number
}

function localPartsToTarget(parts: LocalDateTimeParts): LocalTarget {
  const parsed = parseLocalDateTime(parts.date, parts.time)
  if (!parsed) {
    throw new Error('Invalid local date parts')
  }
  return parsed
}

function wallClockMinutes(target: LocalTarget): number {
  return (
    Date.UTC(
      target.year,
      target.month - 1,
      target.day,
      target.hour,
      target.minute
    ) / 60_000
  )
}

function safeTimeZone(timezone?: string | null): string {
  const timeZone = timezone || DEFAULT_TIMEZONE
  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format(new Date(0))
    return timeZone
  } catch {
    return DEFAULT_TIMEZONE
  }
}

function pad2(value: number): string {
  return value.toString().padStart(2, '0')
}
