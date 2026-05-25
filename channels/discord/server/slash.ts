import 'server-only'
import type { DiscordAdapter } from '@chat-adapter/discord'
import type { Chat, StreamEvent, Thread } from 'chat'
import { after } from 'next/server'
import { z } from 'zod'
import { runChannelChatTurn } from '@/channels/server/dispatch'
import { resolveRoutesForIncomingMessage } from '@/channels/server/routing'
import type {
  IncomingChannelMessage,
  IncomingChannelTurn,
} from '@/channels/server/types'
import { DiscordApiError, discordBotFetch, readDiscordJson } from './api'
import type { DiscordSlashEvent } from './incoming-message'
import { discordGuildScope, discordUserScope } from './thread-ids'

const DISCORD_THREAD_TIMEOUT_MS = 5000
const SLASH_LOCK_TTL_MS = 30_000

const discordSlashRawSchema = z.object({
  channel: z
    .object({
      parent_id: z.string().nullable().optional(),
      type: z.number().optional(),
    })
    .optional(),
  channel_id: z.string().min(1),
  guild_id: z.string().min(1).optional(),
  id: z.string().min(1),
  member: z
    .object({
      user: z
        .object({
          global_name: z.string().nullable().optional(),
          id: z.string().min(1),
          username: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
  user: z
    .object({
      global_name: z.string().nullable().optional(),
      id: z.string().min(1),
      username: z.string().optional(),
    })
    .optional(),
})

export interface ParsedDiscordSlashRaw {
  channelId: string
  channelType: number | null
  guildId: string | null
  interactionId: string
  parentChannelId: string | null
  userDisplayName: string | null
  userId: string
  userName: string | null
}

export function parseDiscordSlashRaw(raw: unknown): ParsedDiscordSlashRaw {
  const parsed = discordSlashRawSchema.parse(raw)
  const user = parsed.member?.user ?? parsed.user
  if (!user) {
    throw new Error('Discord slash interaction is missing user data.')
  }
  return {
    channelId: parsed.channel_id,
    channelType: parsed.channel?.type ?? null,
    guildId: parsed.guild_id ?? null,
    interactionId: parsed.id,
    parentChannelId: parsed.channel?.parent_id ?? null,
    userDisplayName: user.global_name ?? user.username ?? null,
    userId: user.id,
    userName: user.username ?? null,
  }
}

export async function handleDiscordAgentSlashCommand(input: {
  adapter: DiscordAdapter
  bot: Chat<{ discord: DiscordAdapter }>
  event: DiscordSlashEvent
}): Promise<void> {
  const { adapter, bot, event } = input
  const parsed = parseDiscordSlashRaw(event.raw)
  const prompt = event.text.trim()
  if (!prompt) {
    await event.channel.post('Usage: /agent <prompt>')
    return
  }

  const baseTurn = buildDiscordSlashTurn({
    command: event.command,
    encodedThreadId: event.channel.id,
    parsed,
    prompt,
  })
  const routes = await resolveRoutesForIncomingMessage(baseTurn)
  if (routes.length === 0) {
    await event.channel.post(
      'No OUTNA.ME agent is bound to this Discord channel or DM yet. Open the agent Integrations page and add a Discord binding first.'
    )
    return
  }

  const lockKey = `discord:slash:lock:${parsed.interactionId}`
  const locked = await bot
    .getState()
    .setIfNotExists(lockKey, crypto.randomUUID(), SLASH_LOCK_TTL_MS)
  if (!locked) {
    return
  }

  const thread = await resolveSlashThread({
    adapter,
    bot,
    event,
    parsed,
    prompt,
  })
  if (!thread) {
    return
  }

  await thread.subscribe()
  const turn = buildDiscordSlashTurn({
    command: event.command,
    encodedThreadId: thread.id,
    parsed,
    prompt,
    providerHistory: () => collectThreadHistory(thread),
  })

  after(async () => {
    const handled = await runChannelChatTurn({
      turn,
      sink: {
        postAgentStream: async (stream) => {
          await thread.post(stream as AsyncIterable<string | StreamEvent>)
        },
        postText: async (text) => {
          await thread.post(text)
        },
        postError: async (errorText) => {
          await thread.post(errorText)
        },
        scheduleBackgroundTask(task) {
          after(task)
        },
        startTyping: async (status) => {
          await thread.startTyping(status)
        },
      },
    })
    if (!handled) {
      await thread.post(
        'No OUTNA.ME agent is bound to this Discord channel or DM anymore.'
      )
    }
  })
}

async function resolveSlashThread(input: {
  adapter: DiscordAdapter
  bot: Chat<{ discord: DiscordAdapter }>
  event: DiscordSlashEvent
  parsed: ParsedDiscordSlashRaw
  prompt: string
}): Promise<Thread | null> {
  const { adapter, bot, event, parsed, prompt } = input
  if (isDmSlash(parsed)) {
    return bot.thread(event.channel.id)
  }

  if (isThreadSlash(parsed)) {
    const encodedThreadId = adapter.encodeThreadId({
      channelId: parsed.parentChannelId ?? parsed.channelId,
      guildId: parsed.guildId ?? '@me',
      threadId: parsed.channelId,
    })
    return bot.thread(encodedThreadId)
  }

  const starter = await event.channel.post(`Starting a thread for: ${prompt}`)
  try {
    const thread = await createDiscordThreadFromMessage({
      channelId: parsed.channelId,
      messageId: starter.id,
    })
    const encodedThreadId = adapter.encodeThreadId({
      channelId: parsed.channelId,
      guildId: parsed.guildId ?? '@me',
      threadId: thread.id,
    })
    return bot.thread(encodedThreadId)
  } catch (error) {
    console.error('[discord] failed to create slash command thread', {
      channelId: parsed.channelId,
      error,
      interactionId: parsed.interactionId,
    })
    const permissionMessage =
      error instanceof DiscordApiError && error.status === 403
        ? 'I could not create a Discord thread for this request because the bot lacks thread permissions in this channel.'
        : 'I could not create a Discord thread for this request. Check that the bot can create and send messages in public threads.'
    await event.channel.post(permissionMessage)
    return null
  }
}

function buildDiscordSlashTurn(input: {
  command: string
  encodedThreadId: string
  parsed: ParsedDiscordSlashRaw
  prompt: string
  providerHistory?: () => Promise<IncomingChannelMessage[]>
}): IncomingChannelTurn {
  const { command, encodedThreadId, parsed, prompt } = input
  const isDm = isDmSlash(parsed)
  const externalScopeId = isDm
    ? discordUserScope(parsed.userId)
    : discordGuildScope(parsed.guildId ?? '')
  const routingKey = isDm
    ? parsed.userId
    : (parsed.parentChannelId ?? parsed.channelId)
  const providerMetadata = {
    discordChannelId: parsed.parentChannelId ?? parsed.channelId,
    discordCommand: command,
    discordGuildId: parsed.guildId ?? '@me',
    discordInteractionId: parsed.interactionId,
    discordThreadId: encodedThreadId,
  }
  return {
    channel: 'discord',
    current: {
      createdAt: new Date(),
      externalMessageKey: `discord-interaction:${parsed.interactionId}`,
      externalUserDisplayName:
        parsed.userDisplayName ?? parsed.userName ?? undefined,
      externalUserId: parsed.userId,
      providerMetadata,
      text: prompt,
    },
    externalScopeId,
    externalThreadId: encodedThreadId,
    providerHistory: input.providerHistory,
    providerMetadata,
    routing: {
      key: routingKey,
      kind: isDm ? 'dm' : 'channel',
    },
  }
}

function isDmSlash(parsed: ParsedDiscordSlashRaw): boolean {
  return !parsed.guildId || parsed.guildId === '@me' || parsed.channelType === 1
}

function isThreadSlash(parsed: ParsedDiscordSlashRaw): boolean {
  return parsed.channelType === 11 || parsed.channelType === 12
}

async function createDiscordThreadFromMessage(input: {
  channelId: string
  messageId: string
}): Promise<{ id: string; name: string }> {
  const response = await discordBotFetch(
    `/channels/${input.channelId}/messages/${input.messageId}/threads`,
    {
      body: {
        auto_archive_duration: 1440,
        name: `Agent ${new Date().toLocaleString('en-US')}`,
      },
      method: 'POST',
      signal: AbortSignal.timeout(DISCORD_THREAD_TIMEOUT_MS),
    }
  )
  return await readDiscordJson<{ id: string; name: string }>(response)
}

async function collectThreadHistory(
  thread: Thread
): Promise<IncomingChannelMessage[]> {
  try {
    const messages: IncomingChannelMessage[] = []
    for await (const message of thread.allMessages) {
      if (message.author?.isMe || message.author?.isBot === true) {
        continue
      }
      messages.push({
        createdAt: message.metadata.dateSent,
        externalMessageKey: message.id,
        externalUserDisplayName:
          message.author?.fullName ?? message.author?.userName,
        externalUserId: message.author?.userId ?? 'unknown',
        text: message.text,
      })
    }
    return messages
  } catch (error) {
    console.warn('[discord] failed to import thread history; falling back', {
      error: error instanceof Error ? error.message : String(error),
      threadId: thread.id,
    })
    return []
  }
}
