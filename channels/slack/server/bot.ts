import 'server-only'
import { createSlackAdapter, type SlackAdapter } from '@chat-adapter/slack'
import { Chat, type StreamEvent } from 'chat'
import { after } from 'next/server'
import { runChannelChatTurn } from '@/channels/server/dispatch'
import type { IncomingChannelMessage } from '@/channels/server/types'
import {
  buildIncomingSlackMessage,
  buildIncomingSlackTurn,
  type SlackChat,
  type SlackMessage,
  type SlackMessageContext,
  type SlackThread,
} from './incoming-message'
import { SlackHybridState } from './state'

interface SlackBotBundle {
  adapter: SlackAdapter
  bot: SlackChat
}

let cachedBundle: SlackBotBundle | null = null

function buildBundle(): SlackBotBundle {
  const userName = process.env.SLACK_BOT_USERNAME ?? 'assistant'
  const clientId = process.env.SLACK_CLIENT_ID
  const clientSecret = process.env.SLACK_CLIENT_SECRET
  if (!(clientId && clientSecret)) {
    throw new Error(
      'SLACK_CLIENT_ID and SLACK_CLIENT_SECRET are required to run the Slack bot.'
    )
  }

  const adapter = createSlackAdapter({
    userName,
    clientId,
    clientSecret,
  })

  const bot: SlackChat = new Chat({
    userName,
    adapters: { slack: adapter },
    // Persist owner-scoped installations in `channel_installations`; locks,
    // queue, dedupe, subscriptions, and ephemeral state stay in Redis via the
    // inner backing adapter.
    state: new SlackHybridState(),
    concurrency: 'queue',
  })

  registerHandlers(bot)

  return { bot, adapter }
}

function ensureBundle(): SlackBotBundle {
  if (!cachedBundle) {
    cachedBundle = buildBundle()
  }
  return cachedBundle
}

export function getSlackBot(): SlackChat {
  return ensureBundle().bot
}

export function getSlackAdapter(): SlackAdapter {
  return ensureBundle().adapter
}

function registerHandlers(bot: SlackChat): void {
  bot.onNewMention(async (thread, message, context) => {
    await thread.subscribe()
    await handleSlackMessage({ thread, message, kind: 'channel', context })
  })

  bot.onDirectMessage(async (thread, message, _channel, context) => {
    await thread.subscribe()
    await handleSlackMessage({ thread, message, kind: 'dm', context })
  })

  bot.onSubscribedMessage(async (thread, message, context) => {
    // Reuse the routing kind captured when the thread subscription started.
    await handleSlackMessage({
      thread,
      message,
      kind: thread.isDM ? 'dm' : 'channel',
      context,
    })
  })
}

async function handleSlackMessage(input: {
  thread: SlackThread
  message: SlackMessage
  kind: 'channel' | 'dm'
  context?: SlackMessageContext
}): Promise<void> {
  const { thread, message, kind, context } = input
  const skipped = (context?.skipped ?? [])
    .map((skipped) =>
      buildIncomingSlackMessage({
        thread,
        message: skipped as SlackMessage,
      })
    )
    .filter((skipped): skipped is IncomingChannelMessage => Boolean(skipped))
  const incoming = buildIncomingSlackTurn({
    thread,
    message,
    kind,
    providerHistory: () => collectThreadHistory(thread),
    skipped,
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
    console.warn('[slack] no agent binding for incoming message', {
      externalScopeId: incoming.externalScopeId,
      externalThreadId: incoming.externalThreadId,
      kind,
      routingKey: incoming.routing.key,
    })
  }
}

// Provider history is a best-effort import into the canonical Postgres
// transcript. Runtime model context is loaded from `chat_message`, not from the
// provider history directly.
async function collectThreadHistory(
  thread: SlackThread
): Promise<IncomingChannelMessage[]> {
  try {
    const messages: IncomingChannelMessage[] = []
    for await (const m of thread.allMessages) {
      if (m.author?.isMe || m.author?.isBot === true) {
        continue
      }
      const incoming = buildIncomingSlackMessage({
        thread,
        message: m as SlackMessage,
      })
      if (incoming) {
        messages.push(incoming)
      }
    }
    return messages
  } catch (err) {
    console.warn('[slack] failed to import thread history; falling back', {
      err: err instanceof Error ? err.message : String(err),
      threadId: thread.id,
    })
    return []
  }
}
