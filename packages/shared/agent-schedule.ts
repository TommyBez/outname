const AGENT_SCHEDULE_MODES = ['interval', 'daily_times'] as const

export type AgentScheduleMode = (typeof AGENT_SCHEDULE_MODES)[number]

export const MAX_DAILY_SCHEDULE_TIMES = 8

const DAILY_TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

function isAgentScheduleMode(value: unknown): value is AgentScheduleMode {
  return value === 'interval' || value === 'daily_times'
}

export function normalizeAgentScheduleMode(value: unknown): AgentScheduleMode {
  return isAgentScheduleMode(value) ? value : 'interval'
}

function isDailyScheduleTime(value: unknown): value is string {
  return typeof value === 'string' && DAILY_TIME_PATTERN.test(value)
}

export function normalizeDailyScheduleTimes(
  values: readonly string[] | null | undefined
): string[] {
  const normalized = new Set<string>()
  for (const value of values ?? []) {
    const trimmed = value.trim()
    if (isDailyScheduleTime(trimmed)) {
      normalized.add(trimmed)
    }
  }
  return [...normalized].toSorted()
}

export function validateDailyScheduleTimes(
  values: readonly string[] | null | undefined
): string[] {
  const rawValues = values ?? []
  for (const value of rawValues) {
    if (!isDailyScheduleTime(value.trim())) {
      throw new Error('Schedule times must use HH:mm format.')
    }
  }

  const normalized = normalizeDailyScheduleTimes(rawValues)
  if (normalized.length === 0) {
    throw new Error('Add at least one schedule time.')
  }
  if (normalized.length > MAX_DAILY_SCHEDULE_TIMES) {
    throw new Error(`Add at most ${MAX_DAILY_SCHEDULE_TIMES} schedule times.`)
  }
  return normalized
}

export function normalizeScheduleTimesForMode(input: {
  enabled: boolean
  mode: AgentScheduleMode
  times: readonly string[] | null | undefined
}): string[] {
  if (!(input.enabled && input.mode === 'daily_times')) {
    return normalizeDailyScheduleTimes(input.times)
  }
  return validateDailyScheduleTimes(input.times)
}
