import { formatTimezoneOffsetPreview } from '@outname/shared/timezone-options'
import { formatWithDateTimeFormat, getDateTimeFormat } from './intl/formatters'

const DEFAULT_ACCOUNT_TIMEZONE = 'UTC'

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) {
    return null
  }
  const date = typeof value === 'string' ? new Date(value) : value
  return Number.isNaN(date.getTime()) ? null : date
}

export function safeAccountTimeZone(
  timeZone: string | null | undefined
): string {
  const candidate = (timeZone ?? DEFAULT_ACCOUNT_TIMEZONE).trim()
  if (!candidate) {
    return DEFAULT_ACCOUNT_TIMEZONE
  }
  try {
    getDateTimeFormat('en-US', { timeZone: candidate }).format(new Date(0))
    return candidate
  } catch {
    return DEFAULT_ACCOUNT_TIMEZONE
  }
}

export function formatDateTimeInTimeZone(
  date: Date | string | null | undefined,
  timeZone: string
): string {
  const parsed = toDate(date)
  if (!parsed) {
    return '—'
  }
  return formatWithDateTimeFormat(
    undefined,
    {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: safeAccountTimeZone(timeZone),
    },
    parsed
  )
}

export function formatTimeInTimeZone(
  date: Date | string | null | undefined,
  timeZone: string,
  options?: { includeSeconds?: boolean }
): string {
  const parsed = toDate(date)
  if (!parsed) {
    return '—'
  }
  return formatWithDateTimeFormat(
    undefined,
    {
      hour: '2-digit',
      minute: '2-digit',
      second: options?.includeSeconds ? '2-digit' : undefined,
      timeZone: safeAccountTimeZone(timeZone),
    },
    parsed
  )
}

export function formatLongDateInTimeZone(
  date: Date | string | null | undefined,
  timeZone: string
): string {
  const parsed = toDate(date)
  if (!parsed) {
    return '—'
  }
  return formatWithDateTimeFormat(
    undefined,
    {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      timeZone: safeAccountTimeZone(timeZone),
    },
    parsed
  )
}

export function formatMediumDateTimeInTimeZone(
  date: Date | string | null | undefined,
  timeZone: string
): string {
  const parsed = toDate(date)
  if (!parsed) {
    return '—'
  }
  return formatWithDateTimeFormat(
    undefined,
    {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: safeAccountTimeZone(timeZone),
    },
    parsed
  )
}

export function formatCompactDateTimeInTimeZone(
  date: Date | string | null | undefined,
  timeZone: string
): string {
  const parsed = toDate(date)
  if (!parsed) {
    return '—'
  }
  return formatWithDateTimeFormat(
    undefined,
    {
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      month: 'short',
      timeZone: safeAccountTimeZone(timeZone),
    },
    parsed
  )
}

export function formatScheduleTimezoneSuffix(timeZone: string): string {
  const normalized = safeAccountTimeZone(timeZone)
  const offset = formatTimezoneOffsetPreview(normalized)
  if (offset) {
    return ` (${offset})`
  }
  return ` (${normalized})`
}

export function formatAccountTimezoneLabel(timeZone: string): string {
  const normalized = safeAccountTimeZone(timeZone)
  const offset = formatTimezoneOffsetPreview(normalized)
  if (offset) {
    return `${normalized} (${offset})`
  }
  return normalized
}

export function formatRelativeInTimeZone(
  date: Date | string | null | undefined,
  timeZone: string
): string {
  if (!date) {
    return '—'
  }
  const parsed = toDate(date)
  if (!parsed) {
    return '—'
  }
  const diffMs = Date.now() - parsed.getTime()
  const sec = Math.round(diffMs / 1000)
  const min = Math.round(sec / 60)
  const hr = Math.round(min / 60)
  const day = Math.round(hr / 24)
  if (sec < 60) {
    return 'just now'
  }
  if (min < 60) {
    return `${min}m ago`
  }
  if (hr < 24) {
    return `${hr}h ago`
  }
  if (day < 7) {
    return `${day}d ago`
  }
  return formatWithDateTimeFormat(
    undefined,
    {
      month: 'short',
      day: 'numeric',
      timeZone: safeAccountTimeZone(timeZone),
    },
    parsed
  )
}
