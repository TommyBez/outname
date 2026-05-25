import 'server-only'
import type { DiscordAdapter } from '@chat-adapter/discord'
import type { Chat, StreamEvent } from 'chat'
import { after } from 'next/server'
import { runChannelChatTurn } from '@/channels/server/dispatch'
import type { IncomingChannelMessage } from '@/channels/server/types'
import {
  buildIncomingDiscordMessage,
  buildIncomingDiscordTurn,
  type DiscordChat,
  type DiscordMessage,
  type DiscordMessageContext,
  type DiscordThread,
} from './incoming-message'
import { handleDiscordAgentSlashCommand } from './slash'

export function registerDiscordHandlers(input: {
  adapter: DiscordAdapter
  bot: Chat<{ discord: DiscordAdapter }>
}): void {
  const bot = input.bot as DiscordChat

  bot.onNewMention(async (thread, message, context) => {
    if (!isDiscordThread(thread)) {
      return
    }
    await thread.subscribe()
    await handleDiscordMessage({
      context,
      kind: thread.isDM ? 'dm' : 'channel',
      message,
      thread,
    })
  })

  bot.onDirectMessage(async (thread, message, _channel, context) => {
    if (!isDiscordThread(thread)) {
      return
    }
    await thread.subscribe()
    await handleDiscordMessage({
      context,
      kind: 'dm',
      message,
      thread,
    })
  })

  bot.onSubscribedMessage(async (thread, message, context) => {
    if (!isDiscordThread(thread)) {
      return
    }
    await handleDiscordMessage({
      context,
      kind: thread.isDM ? 'dm' : 'channel',
      message,
      thread,
    })
  })

  bot.onSlashCommand('/agent', async (event) => {
    if (!event.channel.id.startsWith('discord:')) {
      return
    }
    await handleDiscordAgentSlashCommand({
      adapter: input.adapter,
      bot: input.bot,
      event,
    })
  })
}

function isDiscordThread(thread: DiscordThread): boolean {
  return thread.id.startsWith('discord:')
}

async function handleDiscordMessage(input: {
  context?: DiscordMessageContext
  kind: 'channel' | 'dm'
  message: DiscordMessage
  thread: DiscordThread
}): Promise<void> {
  const { context, kind, message, thread } = input
  const skipped = (context?.skipped ?? [])
    .map((skipped) =>
      buildIncomingDiscordMessage({
        message: skipped as DiscordMessage,
        thread,
      })
    )
    .filter((skipped): skipped is IncomingChannelMessage => Boolean(skipped))
  const incoming = buildIncomingDiscordTurn({
    kind,
    message,
    providerHistory: () => collectThreadHistory(thread),
    skipped,
    thread,
  })
  if (!incoming) {
    return
  }

  const handled = await runChannelChatTurn({
    turn: incoming,
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
    console.warn('[discord] no agent binding for incoming message', {
      externalScopeId: incoming.externalScopeId,
      externalThreadId: incoming.externalThreadId,
      kind,
      routingKey: incoming.routing.key,
    })
    await thread.post(
      'No OUTNA.ME agent is bound to this Discord channel or DM yet. Open the agent Integrations page and add a Discord binding first.'
    )
  }
}

async function collectThreadHistory(
  thread: DiscordThread
): Promise<IncomingChannelMessage[]> {
  try {
    const messages: IncomingChannelMessage[] = []
    for await (const m of thread.allMessages) {
      if (m.author?.isMe || m.author?.isBot === true) {
        continue
      }
      const incoming = buildIncomingDiscordMessage({
        message: m as DiscordMessage,
        thread,
      })
      if (incoming) {
        messages.push(incoming)
      }
    }
    return messages
  } catch (err) {
    console.warn('[discord] failed to import thread history; falling back', {
      err: err instanceof Error ? err.message : String(err),
      threadId: thread.id,
    })
    return []
  }
}
