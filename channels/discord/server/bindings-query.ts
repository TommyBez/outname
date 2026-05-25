import 'server-only'

import { and, eq } from 'drizzle-orm'
import { getChannelInstallationsForUser } from '@/channels/server/installations'
import { db } from '@/shared/db'
import { agentChannelBindings } from '@/shared/db/schema'
import type {
  DiscordGuildInstallationMetadata,
  DiscordUserLinkMetadata,
} from './installations'

export interface DiscordBindingView {
  createdAt: string
  externalKey: string
  externalScopeId: string
  id: string
  installed: boolean
  kind: 'channel' | 'dm'
  scopeLabel: string
}

export interface DiscordGuildInstallationView {
  agentCommandVersion: number
  externalScopeId: string
  guildId: string
  guildName: string | null
  installerDiscordUserId: string
}

export interface DiscordUserLinkView {
  discordUserId: string
  discordUserName: string | null
  externalScopeId: string
}

type DiscordInstallationRow = Awaited<
  ReturnType<typeof getChannelInstallationsForUser>
>[number]

export async function listDiscordBindingsForAgent(
  agentId: string,
  userId: string
): Promise<{
  bindings: DiscordBindingView[]
  guilds: DiscordGuildInstallationView[]
  userLinks: DiscordUserLinkView[]
}> {
  const [installs, rows] = await Promise.all([
    getChannelInstallationsForUser(userId, 'discord'),
    db
      .select()
      .from(agentChannelBindings)
      .where(
        and(
          eq(agentChannelBindings.agentId, agentId),
          eq(agentChannelBindings.channel, 'discord')
        )
      ),
  ])

  const guilds = installs
    .filter((row) => row.externalId.startsWith('guild:'))
    .map(toDiscordGuildInstallationView)
  const userLinks = installs
    .filter((row) => row.externalId.startsWith('user:'))
    .map(toDiscordUserLinkView)
  const installLookup = new Map(installs.map((row) => [row.externalId, row]))

  const bindings: DiscordBindingView[] = rows.map((row) => {
    const install = installLookup.get(row.externalScopeId)
    return {
      createdAt: row.createdAt.toISOString(),
      externalKey: row.externalKey,
      externalScopeId: row.externalScopeId,
      id: row.id,
      installed: Boolean(install),
      kind: row.kind,
      scopeLabel: discordScopeLabel(install ?? row.externalScopeId),
    }
  })

  return { bindings, guilds, userLinks }
}

export async function listDiscordInstallationsForUser(userId: string): Promise<{
  guilds: DiscordGuildInstallationView[]
  userLinks: DiscordUserLinkView[]
}> {
  const installs = await getChannelInstallationsForUser(userId, 'discord')
  return {
    guilds: installs
      .filter((row) => row.externalId.startsWith('guild:'))
      .map(toDiscordGuildInstallationView),
    userLinks: installs
      .filter((row) => row.externalId.startsWith('user:'))
      .map(toDiscordUserLinkView),
  }
}

function toDiscordGuildInstallationView(
  row: DiscordInstallationRow
): DiscordGuildInstallationView {
  const meta = row.metadata as Partial<DiscordGuildInstallationMetadata>
  return {
    agentCommandVersion: meta.agentCommandVersion ?? 0,
    externalScopeId: row.externalId,
    guildId: meta.guildId ?? row.externalId.slice('guild:'.length),
    guildName: meta.guildName ?? null,
    installerDiscordUserId: meta.installerDiscordUserId ?? '',
  }
}

function toDiscordUserLinkView(
  row: DiscordInstallationRow
): DiscordUserLinkView {
  const meta = row.metadata as Partial<DiscordUserLinkMetadata>
  return {
    discordUserId: meta.discordUserId ?? row.externalId.slice('user:'.length),
    discordUserName: meta.discordUserName ?? null,
    externalScopeId: row.externalId,
  }
}

function discordScopeLabel(
  rowOrScope: DiscordInstallationRow | string
): string {
  if (typeof rowOrScope === 'string') {
    return rowOrScope
  }
  if (rowOrScope.externalId.startsWith('guild:')) {
    const view = toDiscordGuildInstallationView(rowOrScope)
    return view.guildName ? `${view.guildName} (${view.guildId})` : view.guildId
  }
  const view = toDiscordUserLinkView(rowOrScope)
  return view.discordUserName
    ? `${view.discordUserName} (${view.discordUserId})`
    : view.discordUserId
}
