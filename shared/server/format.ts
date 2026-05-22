import {
  formatCompactDateTimeInTimeZone,
  formatDateTimeInTimeZone,
  formatLongDateInTimeZone,
  formatRelativeInTimeZone,
  formatTimeInTimeZone,
} from '@/shared/format-timezone'

export function formatRelative(
  date: Date | string | null | undefined,
  options?: { timeZone?: string }
): string {
  if (!date) {
    return '—'
  }
  if (options?.timeZone) {
    return formatRelativeInTimeZone(date, options.timeZone)
  }
  const d = typeof date === 'string' ? new Date(date) : date
  const diffMs = Date.now() - d.getTime()
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
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function formatDateTime(
  date: Date | string | null | undefined,
  options?: { timeZone?: string }
): string {
  if (!date) {
    return '—'
  }
  if (options?.timeZone) {
    return formatDateTimeInTimeZone(date, options.timeZone)
  }
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function formatTime(
  date: Date | string | null | undefined,
  options?: { timeZone?: string; includeSeconds?: boolean }
): string {
  if (!date) {
    return '—'
  }
  if (options?.timeZone) {
    return formatTimeInTimeZone(date, options.timeZone, {
      includeSeconds: options.includeSeconds,
    })
  }
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: options?.includeSeconds ? '2-digit' : undefined,
  })
}

export function formatLongDate(
  date: Date | string | null | undefined,
  options?: { timeZone?: string }
): string {
  if (!date) {
    return '—'
  }
  if (options?.timeZone) {
    return formatLongDateInTimeZone(date, options.timeZone)
  }
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
}

export function formatCompactDateTime(
  date: Date | string | null | undefined,
  options?: { timeZone?: string }
): string {
  if (!date) {
    return '—'
  }
  if (options?.timeZone) {
    return formatCompactDateTimeInTimeZone(date, options.timeZone)
  }
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat(undefined, {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
  }).format(d)
}

const SENDER_EMAIL_LINE = /^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/

export function parseSender(raw: string | null): {
  name: string
  email: string
} {
  if (!raw) {
    return { name: 'Unknown', email: '' }
  }
  const match = raw.match(SENDER_EMAIL_LINE)
  if (match) {
    return { name: match[1].trim() || match[2], email: match[2] }
  }
  return { name: raw.trim(), email: raw.trim() }
}
