import 'server-only'
import { createSlackAdapter, type SlackAdapter } from '@chat-adapter/slack'
import type { ModelMessage } from 'ai'
import {
  Chat,
  type Message as ChatMessage,
  type StreamEvent,
  toAiMessages,
} from 'chat'
import { after } from 'next/server'
import { runChannelChatTurn } from '@/channels/server/dispatch'
import type { IncomingChannelMessage } from '@/channels/server/types'
import {
  buildIncomingSlackMessage,
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
  const incoming = buildIncomingSlackMessage({
    thread,
    message,
    kind,
    loadModelMessages: () => collectThreadHistory(thread),
  })
  if (!incoming) {
    return
  }
  incoming.skipped = (context?.skipped ?? [])
    .map((skipped) =>
      buildIncomingSlackMessage({
        thread,
        message: skipped as SlackMessage,
        kind,
      })
    )
    .filter((skipped): skipped is IncomingChannelMessage => Boolean(skipped))

  const handled = await runChannelChatTurn({
    message: incoming,
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
      channelId: readString(incoming.threadMetadata, 'slackChannel'),
      teamId: incoming.teamId,
      kind,
      routingKey: incoming.externalRoutingKey,
    })
  }
}

// Materialise the full Slack thread into AI SDK model messages. Chat SDK
// auto-paginates and maps `author.isMe` to "assistant", so the LLM sees the
// real conversation rather than just the latest user turn. Image and text-file
// attachments come through as `FilePart`/`ImagePart` with inlined data, so the
// model gets vision/file context too — pick a multimodal model for any agent
// bound to channels where users share media.
async function collectThreadHistory(
  thread: SlackThread
): Promise<ModelMessage[] | undefined> {
  try {
    const messages: ChatMessage[] = []
    for await (const m of thread.allMessages) {
      messages.push(m)
    }
    if (messages.length === 0) {
      return
    }
    // `includeNames` prefixes user turns with `[name]:` so multi-user channels
    // stay attributable. Harmless in 1:1 DMs.
    const aiMessages = await toAiMessages(messages, { includeNames: true })
    return aiMessages as ModelMessage[]
  } catch (err) {
    // Fall back to "new turn only" — the workflow still works, just without
    // history, which matches the pre-Chat-SDK-hydration behaviour.
    console.warn('[slack] failed to hydrate thread history; falling back', {
      err: err instanceof Error ? err.message : String(err),
      threadId: thread.id,
    })
    return
  }
}

function readString(
  value: Record<string, unknown> | undefined,
  key: string
): string {
  const item = value?.[key]
  return typeof item === 'string' ? item : ''
}
