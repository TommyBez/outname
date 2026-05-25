import 'server-only'
import { and, asc, eq } from 'drizzle-orm'
import { db } from '@/shared/db/pool'
import {
  type ChannelInstallation,
  channelInstallations,
} from '@/shared/db/schema'
import type { ChannelId } from './types'

// Slack bot tokens are shared per workspace, so the adapter can use any active row here.
// Routing must use `getChannelInstallationsByScope()` so fan-out sees every user install.
export async function getChannelInstallationByScope(
  channel: ChannelId,
  externalScopeId: string
): Promise<ChannelInstallation | null> {
  const [row] = await db
    .select()
    .from(channelInstallations)
    .where(
      and(
        eq(channelInstallations.channel, channel),
        eq(channelInstallations.externalId, externalScopeId)
      )
    )
    .limit(1)
  return row ?? null
}

export async function getChannelInstallationsByScope(
  channel: ChannelId,
  externalScopeId: string
): Promise<ChannelInstallation[]> {
  return await db
    .select()
    .from(channelInstallations)
    .where(
      and(
        eq(channelInstallations.channel, channel),
        eq(channelInstallations.externalId, externalScopeId)
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
