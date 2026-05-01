export const DEFAULT_TIMEZONE = 'UTC'

/**
 * Return a stable YYYY-MM-DD date for `date` in an IANA timezone.
 * Falls back to UTC if the stored timezone is invalid.
 */
export function localDateKey(date: Date, timezone?: string | null): string {
  const timeZone = timezone || DEFAULT_TIMEZONE
  try {
    return formatLocalDate(date, timeZone)
  } catch {
    return formatLocalDate(date, DEFAULT_TIMEZONE)
  }
}

function formatLocalDate(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: '2-digit',
    timeZone,
    year: 'numeric',
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map((p) => [p.type, p.value]))
  return `${values.year}-${values.month}-${values.day}`
}
