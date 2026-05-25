import 'server-only'

import { and, eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { db } from '@/shared/db'
import {
  type ChannelInstallation,
  channelInstallations,
} from '@/shared/db/schema'
import { discordGuildScope, discordUserScope } from './thread-ids'

export interface DiscordGuildInstallationMetadata {
  agentCommandVersion: number
  guildId: string
  guildName: string | null
  installerDiscordUserId: string
  permissions: string | null
}

export interface DiscordUserLinkMetadata {
  discordUserId: string
  discordUserName: string | null
}

export async function saveDiscordInstallation(input: {
  agentCommandVersion: number
  discordUserId: string
  discordUserName: string | null
  guildId: string
  guildName: string | null
  permissions: string | null
  userId: string
}): Promise<{
  guildRow: ChannelInstallation
  userLinkRow: ChannelInstallation
}> {
  const guildRow = await upsertDiscordInstallationRow({
    externalId: discordGuildScope(input.guildId),
    metadata: {
      agentCommandVersion: input.agentCommandVersion,
      guildId: input.guildId,
      guildName: input.guildName,
      installerDiscordUserId: input.discordUserId,
      permissions: input.permissions,
    } satisfies DiscordGuildInstallationMetadata,
    userId: input.userId,
  })

  const userLinkRow = await upsertDiscordInstallationRow({
    externalId: discordUserScope(input.discordUserId),
    metadata: {
      discordUserId: input.discordUserId,
      discordUserName: input.discordUserName,
    } satisfies DiscordUserLinkMetadata,
    userId: input.userId,
  })

  return { guildRow, userLinkRow }
}

export async function deleteDiscordGuildInstallation(input: {
  guildId: string
  userId: string
}): Promise<void> {
  const externalId = discordGuildScope(input.guildId)
  const [guildRow] = await db
    .select()
    .from(channelInstallations)
    .where(
      and(
        eq(channelInstallations.userId, input.userId),
        eq(channelInstallations.channel, 'discord'),
        eq(channelInstallations.externalId, externalId)
      )
    )
    .limit(1)

  await db
    .delete(channelInstallations)
    .where(
      and(
        eq(channelInstallations.userId, input.userId),
        eq(channelInstallations.channel, 'discord'),
        eq(channelInstallations.externalId, externalId)
      )
    )

  const metadata = guildRow?.metadata as
    | Partial<DiscordGuildInstallationMetadata>
    | undefined
  const discordUserId = metadata?.installerDiscordUserId
  if (!discordUserId) {
    return
  }

  const remaining = await db
    .select()
    .from(channelInstallations)
    .where(
      and(
        eq(channelInstallations.userId, input.userId),
        eq(channelInstallations.channel, 'discord')
      )
    )
  const stillLinked = remaining.some((row) => {
    if (!row.externalId.startsWith('guild:')) {
      return false
    }
    const rowMetadata =
      row.metadata as Partial<DiscordGuildInstallationMetadata>
    return rowMetadata.installerDiscordUserId === discordUserId
  })
  if (stillLinked) {
    return
  }

  await db
    .delete(channelInstallations)
    .where(
      and(
        eq(channelInstallations.userId, input.userId),
        eq(channelInstallations.channel, 'discord'),
        eq(channelInstallations.externalId, discordUserScope(discordUserId))
      )
    )
}

async function upsertDiscordInstallationRow(input: {
  externalId: string
  metadata: Record<string, unknown>
  userId: string
}): Promise<ChannelInstallation> {
  const id = `chi_${nanoid(12)}`
  await db
    .insert(channelInstallations)
    .values({
      channel: 'discord',
      credentials: null,
      externalId: input.externalId,
      id,
      metadata: input.metadata,
      status: 'active',
      userId: input.userId,
    })
    .onConflictDoUpdate({
      target: [
        channelInstallations.userId,
        channelInstallations.channel,
        channelInstallations.externalId,
      ],
      set: {
        credentials: null,
        metadata: input.metadata,
        status: 'active',
        updatedAt: new Date(),
      },
    })

  const [row] = await db
    .select()
    .from(channelInstallations)
    .where(
      and(
        eq(channelInstallations.userId, input.userId),
        eq(channelInstallations.channel, 'discord'),
        eq(channelInstallations.externalId, input.externalId)
      )
    )
    .limit(1)
  if (!row) {
    throw new Error(
      `saveDiscordInstallation: row missing after upsert (${input.externalId})`
    )
  }
  return row
}
