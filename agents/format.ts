const MINUTES_PER_HOUR = 60
const MINUTES_PER_DAY = MINUTES_PER_HOUR * 24

type MinuteUnitStyle = 'long' | 'short'

export function formatAgentInterval(minutes: number): string {
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

export function formatAgentCadenceLower(minutes: number): string {
  const cadence = formatAgentCadence(minutes)
  return `${cadence.charAt(0).toLowerCase()}${cadence.slice(1)}`
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
