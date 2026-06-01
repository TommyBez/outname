import { getDateTimeFormat } from './intl/formatters'

export interface TimezoneOption {
  label: string
  value: string
}

/** Curated IANA zones for account settings (scheduling uses the stored value). */
const COMMON_TIMEZONE_OPTIONS: readonly TimezoneOption[] = [
  { value: 'UTC', label: 'UTC' },
  { value: 'Europe/London', label: 'Europe/London' },
  { value: 'Europe/Paris', label: 'Europe/Paris' },
  { value: 'Europe/Berlin', label: 'Europe/Berlin' },
  { value: 'Europe/Rome', label: 'Europe/Rome' },
  { value: 'Europe/Madrid', label: 'Europe/Madrid' },
  { value: 'Europe/Amsterdam', label: 'Europe/Amsterdam' },
  { value: 'Europe/Zurich', label: 'Europe/Zurich' },
  { value: 'Europe/Stockholm', label: 'Europe/Stockholm' },
  { value: 'Europe/Warsaw', label: 'Europe/Warsaw' },
  { value: 'Europe/Athens', label: 'Europe/Athens' },
  { value: 'Europe/Istanbul', label: 'Europe/Istanbul' },
  { value: 'Africa/Cairo', label: 'Africa/Cairo' },
  { value: 'Africa/Johannesburg', label: 'Africa/Johannesburg' },
  { value: 'Asia/Dubai', label: 'Asia/Dubai' },
  { value: 'Asia/Kolkata', label: 'Asia/Kolkata' },
  { value: 'Asia/Bangkok', label: 'Asia/Bangkok' },
  { value: 'Asia/Singapore', label: 'Asia/Singapore' },
  { value: 'Asia/Hong_Kong', label: 'Asia/Hong_Kong' },
  { value: 'Asia/Shanghai', label: 'Asia/Shanghai' },
  { value: 'Asia/Tokyo', label: 'Asia/Tokyo' },
  { value: 'Asia/Seoul', label: 'Asia/Seoul' },
  { value: 'Australia/Sydney', label: 'Australia/Sydney' },
  { value: 'Australia/Melbourne', label: 'Australia/Melbourne' },
  { value: 'Pacific/Auckland', label: 'Pacific/Auckland' },
  { value: 'America/Sao_Paulo', label: 'America/Sao_Paulo' },
  { value: 'America/New_York', label: 'America/New_York' },
  { value: 'America/Chicago', label: 'America/Chicago' },
  { value: 'America/Denver', label: 'America/Denver' },
  { value: 'America/Los_Angeles', label: 'America/Los_Angeles' },
  { value: 'America/Toronto', label: 'America/Toronto' },
  { value: 'America/Vancouver', label: 'America/Vancouver' },
  { value: 'America/Mexico_City', label: 'America/Mexico_City' },
] as const

export function buildTimezoneOptions(current: string): TimezoneOption[] {
  const options = [...COMMON_TIMEZONE_OPTIONS]
  if (current && !options.some((option) => option.value === current)) {
    options.unshift({ value: current, label: current })
  }
  return options
}

export function getBrowserIanaTimeZone(): string | null {
  try {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
    return timeZone?.trim() ? timeZone : null
  } catch {
    return null
  }
}

export function formatTimezoneOffsetPreview(
  timeZone: string,
  date = new Date()
): string | null {
  try {
    const parts = getDateTimeFormat('en-US', {
      timeZone,
      timeZoneName: 'shortOffset',
    }).formatToParts(date)
    return parts.find((part) => part.type === 'timeZoneName')?.value ?? null
  } catch {
    return null
  }
}
