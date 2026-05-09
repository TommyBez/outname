import 'server-only'
import { and, eq } from 'drizzle-orm'
import { db } from '@/shared/db'
import {
  type ChannelInstallation,
  channelInstallations,
} from '@/shared/db/schema'
import type { ChannelId } from './types'

/**
 * Returns the first `channel_installations` row for a given workspace.
 *
 * Used by the chat SDK adapter (`SlackHybridState.get`) to load a bot
 * token: every install of the same Slack workspace shares the same
 * bot token (one Slack app), so picking any active row is correct.
 *
 * Routing should not use this helper — it needs every install for the
 * workspace so that all subscribed users are dispatched to. Use
 * `getChannelInstallationsByTeam` instead.
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

/**
 * All `channel_installations` rows for a given workspace. In a
 * multi-user deployment several platform users can each install the
 * same Slack workspace; the resolver iterates these rows so an
 * incoming message fans out to every user with a matching binding.
 */
export async function getChannelInstallationsByTeam(
  channel: ChannelId,
  teamId: string
): Promise<ChannelInstallation[]> {
  return await db
    .select()
    .from(channelInstallations)
    .where(
      and(
        eq(channelInstallations.channel, channel),
        eq(channelInstallations.externalId, teamId)
      )
    )
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
