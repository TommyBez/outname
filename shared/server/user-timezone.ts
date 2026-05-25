import 'server-only'
import { eq } from 'drizzle-orm'
import { cacheLife, cacheTag, revalidateTag } from 'next/cache'
import { db } from '@/shared/db/pool'
import { user } from '@/shared/db/schema'
import { userTimezoneTag } from '@/shared/server/cache-tags'
import {
  DEFAULT_TIMEZONE,
  normalizeUserTimeZone,
} from '@/shared/server/timezone'

export type TimezoneSetSource = 'auto' | 'manual'

export interface UserTimezoneBootstrapState {
  allowAutoSync: boolean
  timezone: string
}

export async function queryUserTimezoneBootstrapState(
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

export async function getCachedUserTimezoneBootstrapState(
  userId: string
): Promise<UserTimezoneBootstrapState> {
  'use cache'

  cacheLife('minutes')
  cacheTag(userTimezoneTag(userId))
  return await queryUserTimezoneBootstrapState(userId)
}

export async function getCachedUserTimezone(userId: string): Promise<string> {
  const state = await getCachedUserTimezoneBootstrapState(userId)
  return state.timezone
}

/** Request-time lookup for writes and other paths that must bypass cache. */
export async function getUserTimezone(userId: string): Promise<string> {
  const state = await queryUserTimezoneBootstrapState(userId)
  return state.timezone
}

export async function getUserTimezoneBootstrapState(
  userId: string
): Promise<UserTimezoneBootstrapState> {
  return await getCachedUserTimezoneBootstrapState(userId)
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
    const state = await queryUserTimezoneBootstrapState(input.userId)
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

  revalidateTag(userTimezoneTag(input.userId), 'max')

  return { ok: true, timezone: normalized }
}
