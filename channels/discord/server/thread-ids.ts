export interface DiscordAttachmentLike {
  content_type?: string | null
  filename?: string
  id?: string
  url?: string
}

export interface DiscordRawMessage {
  attachments?: DiscordAttachmentLike[]
  author?: {
    bot?: boolean
    global_name?: string | null
    id?: string
    username?: string
  }
  channel_id?: string
  guild_id?: string
  id?: string
  thread?: {
    id?: string
    parent_id?: string | null
  }
  timestamp?: string
}

export interface DiscordThreadRef {
  channelId: string
  id: string
}

export interface DiscordThreadParts {
  channelId: string
  guildId: string
  threadId?: string
}

const DISCORD_ID_PREFIX = 'discord:'

export function discordGuildScope(guildId: string): string {
  return `guild:${guildId}`
}

export function discordUserScope(discordUserId: string): string {
  return `user:${discordUserId}`
}

export function parseDiscordThreadId(
  threadId: string
): DiscordThreadParts | null {
  if (!threadId.startsWith(DISCORD_ID_PREFIX)) {
    return null
  }
  const parts = threadId.split(':')
  if (parts.length < 3) {
    return null
  }
  const [, guildId, channelId, discordThreadId] = parts
  if (!(guildId && channelId)) {
    return null
  }
  return {
    channelId,
    guildId,
    ...(discordThreadId ? { threadId: discordThreadId } : {}),
  }
}

export function extractDiscordThread(
  thread: DiscordThreadRef,
  raw: DiscordRawMessage | undefined
): DiscordThreadParts | null {
  const parsed = parseDiscordThreadId(thread.id)
  if (parsed) {
    return parsed
  }

  const channelParsed = parseDiscordThreadId(thread.channelId)
  const guildId = raw?.guild_id ?? channelParsed?.guildId
  const channelId =
    raw?.thread?.parent_id ??
    raw?.channel_id ??
    channelParsed?.channelId ??
    thread.channelId
  if (!(guildId && channelId)) {
    return null
  }
  return {
    channelId,
    guildId,
    ...(raw?.thread?.id ? { threadId: raw.thread.id } : {}),
  }
}

export function describeDiscordAttachments(
  raw: DiscordRawMessage | undefined
): string {
  const attachments = raw?.attachments
  if (!Array.isArray(attachments) || attachments.length === 0) {
    return ''
  }
  const entries: string[] = []
  for (const attachment of attachments) {
    const name = attachment.filename?.trim() || 'attachment'
    const mime = attachment.content_type?.trim()
    entries.push(mime ? `${name} (${mime})` : name)
  }
  return entries.join(', ')
}
