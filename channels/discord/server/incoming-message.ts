import 'server-only'
import type { DiscordAdapter } from '@chat-adapter/discord'
import type { Chat } from 'chat'
import type {
  IncomingChannelMessage,
  IncomingChannelTurn,
} from '@/channels/server/types'
import {
  type DiscordRawMessage,
  describeDiscordAttachments,
  discordGuildScope,
  discordUserScope,
  extractDiscordThread,
} from './thread-ids'

export type DiscordChat = Chat<{ discord: DiscordAdapter }>
export type DiscordThread = Parameters<
  Parameters<DiscordChat['onNewMention']>[0]
>[0]
export type DiscordMessage = Parameters<
  Parameters<DiscordChat['onNewMention']>[0]
>[1]
export type DiscordMessageContext = Parameters<
  Parameters<DiscordChat['onNewMention']>[0]
>[2]
export type DiscordSlashEvent = Parameters<
  Parameters<DiscordChat['onSlashCommand']>[1]
>[0]

export function buildIncomingDiscordTurn(input: {
  thread: DiscordThread
  message: DiscordMessage
  kind: 'channel' | 'dm'
  providerHistory?: () => Promise<IncomingChannelMessage[]>
  skipped?: IncomingChannelMessage[]
}): IncomingChannelTurn | null {
  const current = buildIncomingDiscordMessage({
    message: input.message,
    thread: input.thread,
  })
  if (!current) {
    return null
  }

  const raw = input.message.raw as DiscordRawMessage | undefined
  const discordThread = extractDiscordThread(input.thread, raw)
  if (!discordThread) {
    console.warn('[discord] thread missing discord ids; skipping', {
      channelId: input.thread.channelId,
      threadId: input.thread.id,
    })
    return null
  }

  const externalScopeId =
    input.kind === 'dm'
      ? discordUserScope(input.message.author?.userId ?? '')
      : discordGuildScope(discordThread.guildId)
  if (externalScopeId.endsWith(':')) {
    console.warn('[discord] dropping event with no owner scope', {
      kind: input.kind,
      threadId: input.thread.id,
    })
    return null
  }

  const messageId = raw?.id ?? input.message.id
  const discordThreadId = discordThread.threadId ?? input.thread.id
  const routingKey =
    input.kind === 'dm'
      ? (input.message.author?.userId ?? '')
      : discordThread.channelId
  if (!routingKey) {
    console.warn('[discord] dropping event with no routing key', {
      kind: input.kind,
      threadId: input.thread.id,
    })
    return null
  }

  return {
    channel: 'discord',
    current,
    externalScopeId,
    externalThreadId: input.thread.id,
    providerHistory: input.providerHistory,
    providerMetadata: {
      discordChannelId: discordThread.channelId,
      discordGuildId: discordThread.guildId,
      discordMessageId: messageId,
      discordThreadId,
    },
    routing: {
      key: routingKey,
      kind: input.kind,
    },
    skipped: input.skipped,
  }
}

export function buildIncomingDiscordMessage(input: {
  thread: DiscordThread
  message: DiscordMessage
}): IncomingChannelMessage | null {
  const { message, thread } = input
  const raw = message.raw as DiscordRawMessage | undefined
  const trimmedText = message.text?.trim() ?? ''
  const attachmentSummary = describeDiscordAttachments(raw)
  if (!(trimmedText || attachmentSummary)) {
    return null
  }
  const text = trimmedText || `(attachment: ${attachmentSummary})`

  const discordThread = extractDiscordThread(thread, raw)
  if (!discordThread) {
    console.warn('[discord] thread missing discord ids; skipping', {
      channelId: thread.channelId,
      threadId: thread.id,
    })
    return null
  }
  const messageId = raw?.id ?? message.id
  const discordThreadId = discordThread.threadId ?? thread.id

  return {
    createdAt: message.metadata.dateSent,
    externalMessageKey: message.id,
    externalUserDisplayName:
      message.author?.fullName ?? message.author?.userName,
    externalUserId: message.author?.userId ?? 'unknown',
    providerMetadata: {
      discordChannelId: discordThread.channelId,
      discordGuildId: discordThread.guildId,
      discordMessageId: messageId,
      discordThreadId,
    },
    text,
  }
}
