import { normalizeDailyScheduleTimes } from '@/shared/agent-schedule'
import {
  localDateTimeParts,
  localDateTimeToUtc,
} from '@/shared/server/timezone'

export interface DailyScheduleDue {
  localDate: string
  scheduledFor: Date
  time: string
}

export function resolveDailyScheduleDue(input: {
  lastRunAt: Date | null
  now: Date
  times: readonly string[] | null | undefined
  timezone: string | null | undefined
}): DailyScheduleDue | null {
  const times = normalizeDailyScheduleTimes(input.times)
  if (times.length === 0) {
    return null
  }

  const localNow = localDateTimeParts(input.now, input.timezone)
  const dueTime = latestDueTime({
    currentTime: localNow.time,
    times,
  })
  if (!dueTime) {
    return null
  }

  const scheduledFor = localDateTimeToUtc({
    localDate: localNow.date,
    time: dueTime,
    timezone: input.timezone,
  })
  if (!scheduledFor) {
    return null
  }
  if (input.lastRunAt && input.lastRunAt.getTime() >= scheduledFor.getTime()) {
    return null
  }

  return {
    localDate: localNow.date,
    scheduledFor,
    time: dueTime,
  }
}

function latestDueTime(input: {
  currentTime: string
  times: readonly string[]
}): string | null {
  let latest: string | null = null
  for (const time of input.times) {
    if (time <= input.currentTime) {
      latest = time
    }
  }
  return latest
}
