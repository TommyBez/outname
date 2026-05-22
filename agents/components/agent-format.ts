import { formatMediumDateTimeInTimeZone } from '@/shared/format-timezone'

export function formatNullableAgentDate(
  value: Date | string | null,
  timeZone: string
): string {
  if (!value) {
    return 'Never'
  }
  return formatMediumDateTimeInTimeZone(value, timeZone)
}
