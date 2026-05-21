import 'server-only'
import { eq } from 'drizzle-orm'
import { db } from '@/shared/db'
import { user } from '@/shared/db/schema'
import {
  DEFAULT_TIMEZONE,
  normalizeUserTimeZone,
} from '@/shared/server/timezone'

export async function getUserTimezone(userId: string): Promise<string> {
  const [row] = await db
    .select({ timezone: user.timezone })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1)
  return row?.timezone ?? DEFAULT_TIMEZONE
}

export async function setUserTimezone(input: {
  userId: string
  timezone: string
}): Promise<{ ok: true; timezone: string } | { ok: false; error: string }> {
  const normalized = normalizeUserTimeZone(input.timezone)
  if (!normalized) {
    return { ok: false, error: 'Choose a valid IANA timezone.' }
  }

  await db
    .update(user)
    .set({
      timezone: normalized,
      updatedAt: new Date(),
    })
    .where(eq(user.id, input.userId))

  return { ok: true, timezone: normalized }
}
