import 'server-only'
import { and, asc, eq } from 'drizzle-orm'
import { db } from '@/shared/db'
import {
  type ChannelInstallation,
  channelInstallations,
} from '@/shared/db/schema'
import type { ChannelId } from './types'

// Slack bot tokens are shared per workspace, so the adapter can use any active row here.
// Routing must use `getChannelInstallationsByTeam()` so fan-out sees every user install.
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
    .orderBy(
      asc(channelInstallations.createdAt),
      asc(channelInstallations.userId),
      asc(channelInstallations.id)
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
