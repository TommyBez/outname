import 'server-only'
import { and, eq } from 'drizzle-orm'
import { db } from '@/shared/db'
import {
  type ChannelInstallation,
  channelInstallations,
} from '@/shared/db/schema'
import type { ChannelId } from './types'

/**
 * Owner-scoping lookup: returns the `channel_installations` row for a
 * given workspace, regardless of which user installed it. The caller
 * uses `installation.userId` to decide whether the matched agent
 * actually belongs to the workspace owner.
 *
 * Multi-user deployments: every webhook that resolves to an agent must
 * also resolve to an installation, otherwise it's rejected — that
 * prevents one user's Slack workspace from triggering another user's
 * agent even if a misconfigured binding exists.
 *
 * Callers may intentionally pass `teamId = ''` for single-workspace or
 * no-workspace channels. We still perform the exact lookup rather than
 * short-circuiting so the helper matches the schema contract for
 * `channel_installations.external_id`.
 */
export async function getChannelInstallationByTeam(
  channel: ChannelId,
  teamId: string
): Promise<ChannelInstallation | null> {
  const [row] = await db
    .select()
    .from(channelInstallations)
    .where(
      and(
        eq(channelInstallations.channel, channel),
        eq(channelInstallations.externalId, teamId)
      )
    )
    .limit(1)
  return row ?? null
}

export async function getChannelInstallationsForUser(
  userId: string,
  channel: ChannelId
): Promise<ChannelInstallation[]> {
  return await db
    .select()
    .from(channelInstallations)
    .where(
      and(
        eq(channelInstallations.userId, userId),
        eq(channelInstallations.channel, channel)
      )
    )
}
