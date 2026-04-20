/**
 * Scheduling helpers: translate user-local time-of-day + days-of-week
 * into concrete UTC Date instants the Workflow SDK can sleep until.
 *
 * We keep this library-free: no zoned-time packages. We use
 * Intl.DateTimeFormat + Date arithmetic, which is sufficient because we only
 * need "next occurrence of HH:MM in tz on one of these ISO weekdays".
 */

/** ISO weekday: 1 = Monday, 7 = Sunday. */
export type IsoWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7

/** JS getDay() returns 0 (Sun) .. 6 (Sat). Convert to ISO (1..7, Mon..Sun). */
function isoWeekday(d: Date): IsoWeekday {
  const js = d.getDay()
  return (js === 0 ? 7 : js) as IsoWeekday
}

/**
 * Given a local target time in a given IANA timezone and a target date
 * expressed in that timezone's calendar, return the UTC Date.
 *
 * We do this by iterating: compute a candidate UTC Date, format it back in
 * the target timezone, and adjust if the resulting local time drifts
 * (handles DST gaps/ambiguous times best-effort).
 */
function zonedTimeToUtc(
  tz: string,
  localYear: number,
  localMonth: number, // 1..12
  localDay: number,
  hour: number,
  minute: number,
): Date {
  // Start with the assumption that the local time equals UTC, then compute
  // the offset at that instant in the target tz and correct.
  const guess = new Date(
    Date.UTC(localYear, localMonth - 1, localDay, hour, minute, 0, 0),
  )
  const localized = formatInTz(guess, tz)
  const offsetMs =
    new Date(
      Date.UTC(
        localized.year,
        localized.month - 1,
        localized.day,
        localized.hour,
        localized.minute,
        0,
        0,
      ),
    ).getTime() - guess.getTime()
  return new Date(guess.getTime() - offsetMs)
}

interface LocalParts {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  weekday: IsoWeekday
}

/** Read the wall-clock parts of a UTC Date as seen in the given timezone. */
export function formatInTz(d: Date, tz: string): LocalParts {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hourCycle: "h23",
  })
  const parts = fmt.formatToParts(d)
  const map: Record<string, string> = {}
  for (const p of parts) {
    if (p.type !== "literal") map[p.type] = p.value
  }
  const weekdayShort = map.weekday // e.g. "Mon"
  const weekdayMap: Record<string, IsoWeekday> = {
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
    Sun: 7,
  }
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    weekday: weekdayMap[weekdayShort] ?? 1,
  }
}

/**
 * Compute the NEXT occurrence (UTC Date) of `HH:MM` in timezone `tz`
 * that falls on one of the allowed ISO weekdays, strictly after `from`.
 * If `scheduleDays` is empty, returns null.
 */
export function nextScheduledRun({
  from,
  tz,
  time, // "HH:MM"
  scheduleDays,
}: {
  from: Date
  tz: string
  time: string
  scheduleDays: number[]
}): Date | null {
  if (!scheduleDays || scheduleDays.length === 0) return null
  const [hh, mm] = time.split(":").map(Number)
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null

  const allowed = new Set(scheduleDays)

  // Walk day-by-day in the target timezone up to 14 days ahead.
  for (let offset = 0; offset < 14; offset++) {
    const probeUtc = new Date(from.getTime() + offset * 86_400_000)
    const parts = formatInTz(probeUtc, tz)
    if (!allowed.has(parts.weekday)) continue

    const candidate = zonedTimeToUtc(
      tz,
      parts.year,
      parts.month,
      parts.day,
      hh,
      mm,
    )
    if (candidate.getTime() > from.getTime()) return candidate
  }
  return null
}

/**
 * Return true if the schedule should fire today in the user's tz (used by the
 * cron runner which fires once per UTC day-start).
 */
export function schedulesFireToday({
  now,
  tz,
  scheduleDays,
}: {
  now: Date
  tz: string
  scheduleDays: number[]
}): boolean {
  const parts = formatInTz(now, tz)
  return scheduleDays.includes(parts.weekday)
}

export { isoWeekday }
