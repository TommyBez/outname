import 'server-only'
import { and, eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { decryptCredential, encryptCredential } from '@/connections/crypto'
import { db } from '@/shared/db/pool'
import {
  type ChannelInstallation,
  channelInstallations,
} from '@/shared/db/schema'

export interface SlackInstallationPlain {
  botToken: string
  botUserId?: string
  teamName?: string
}

interface InstallationMetadata {
  botUserId?: string
  teamName?: string
}

// OAuth saves run inside install context, so `userId` always comes from the callback session.
export async function saveSlackInstallation(input: {
  userId: string
  teamId: string
  installation: SlackInstallationPlain
}): Promise<ChannelInstallation> {
  const { userId, teamId, installation } = input
  if (!(teamId && installation.botToken)) {
    throw new Error('saveSlackInstallation: teamId and botToken are required')
  }

  const encrypted = await encryptCredential({ botToken: installation.botToken })
  const metadata: InstallationMetadata = {
    botUserId: installation.botUserId,
    teamName: installation.teamName,
  }

  const id = `chi_${nanoid(12)}`
  await db
    .insert(channelInstallations)
    .values({
      id,
      userId,
      channel: 'slack',
      externalId: teamId,
      credentials: encrypted,
      metadata,
      status: 'active',
    })
    .onConflictDoUpdate({
      target: [
        channelInstallations.userId,
        channelInstallations.channel,
        channelInstallations.externalId,
      ],
      set: {
        credentials: encrypted,
        metadata,
        status: 'active',
        updatedAt: new Date(),
      },
    })

  const [row] = await db
    .select()
    .from(channelInstallations)
    .where(
      and(
        eq(channelInstallations.userId, userId),
        eq(channelInstallations.channel, 'slack'),
        eq(channelInstallations.externalId, teamId)
      )
    )
    .limit(1)
  if (!row) {
    throw new Error(
      `saveSlackInstallation: row missing after upsert (team=${teamId})`
    )
  }
  return row
}

// Webhooks only know `team_id`, and every install of a workspace shares the same bot token.
export async function loadSlackInstallationByTeam(teamId: string): Promise<{
  row: ChannelInstallation
  installation: SlackInstallationPlain
} | null> {
  const [row] = await db
    .select()
    .from(channelInstallations)
    .where(
      and(
        eq(channelInstallations.channel, 'slack'),
        eq(channelInstallations.externalId, teamId)
      )
    )
    .limit(1)
  if (!row?.credentials) {
    return null
  }
  let creds: { botToken: string }
  try {
    creds = await decryptCredential<{ botToken: string }>(row.credentials)
  } catch {
    return null
  }
  const meta = (row.metadata ?? {}) as InstallationMetadata
  return {
    row,
    installation: {
      botToken: creds.botToken,
      botUserId: meta.botUserId,
      teamName: meta.teamName,
    },
  }
}

export async function deleteSlackInstallation(input: {
  userId: string
  teamId: string
}): Promise<void> {
  await db
    .delete(channelInstallations)
    .where(
      and(
        eq(channelInstallations.userId, input.userId),
        eq(channelInstallations.channel, 'slack'),
        eq(channelInstallations.externalId, input.teamId)
      )
    )
}
