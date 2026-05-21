import 'server-only'
import { eq } from 'drizzle-orm'
import { db } from '@/shared/db'
import { user } from '@/shared/db/schema'
import {
  DEFAULT_TIMEZONE,
  normalizeUserTimeZone,
} from '@/shared/server/timezone'

export type TimezoneSetSource = 'auto' | 'manual'

export interface UserTimezoneBootstrapState {
  allowAutoSync: boolean
  timezone: string
}

export async function getUserTimezone(userId: string): Promise<string> {
  const state = await getUserTimezoneBootstrapState(userId)
  return state.timezone
}

export async function getUserTimezoneBootstrapState(
  userId: string
): Promise<UserTimezoneBootstrapState> {
  const [row] = await db
    .select({
      timezone: user.timezone,
      timezoneConfiguredAt: user.timezoneConfiguredAt,
    })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1)

  const timezone = row?.timezone ?? DEFAULT_TIMEZONE
  const allowAutoSync =
    timezone === DEFAULT_TIMEZONE && row?.timezoneConfiguredAt == null

  return { timezone, allowAutoSync }
}

export async function setUserTimezone(input: {
  source: TimezoneSetSource
  timezone: string
  userId: string
}): Promise<{ ok: true; timezone: string } | { ok: false; error: string }> {
  const normalized = normalizeUserTimeZone(input.timezone)
  if (!normalized) {
    return { ok: false, error: 'Choose a valid IANA timezone.' }
  }

  if (input.source === 'auto') {
    const state = await getUserTimezoneBootstrapState(input.userId)
    if (!state.allowAutoSync) {
      return {
        ok: false,
        error: 'Timezone is already configured for this account.',
      }
    }
  }

  const now = new Date()
  await db
    .update(user)
    .set({
      timezone: normalized,
      timezoneConfiguredAt: now,
      updatedAt: now,
    })
    .where(eq(user.id, input.userId))

  return { ok: true, timezone: normalized }
}
