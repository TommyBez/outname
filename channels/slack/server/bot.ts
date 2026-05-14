import 'server-only'
import { createSlackAdapter, type SlackAdapter } from '@chat-adapter/slack'
import type { ModelMessage } from 'ai'
import { Chat, type Message as ChatMessage, toAiMessages } from 'chat'
import { runChannelChatTurn } from '@/channels/server/dispatch'
import type { IncomingChannelMessage } from '@/channels/server/types'
import { SlackHybridState } from './state'
import {
  extractSlackTeamId,
  extractSlackThread,
  type SlackRawMessage,
} from './thread-ids'

type SlackChat = Chat<{ slack: SlackAdapter }>
type SlackThread = Parameters<Parameters<SlackChat['onNewMention']>[0]>[0]
type SlackMessage = Parameters<Parameters<SlackChat['onNewMention']>[0]>[1]

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
    // Persist owner-scoped installations in `channel_installations`; locks and
    // subscriptions stay in Redis/memory via the inner backing adapter.
    state: new SlackHybridState(),
    // The canonical queue lives in `agent_events`; this only protects webhook
    // ingestion from overlapping handler work inside the Chat SDK.
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

// Top-level messages use their own ts so direct replies still round-trip as a
// stable synthetic thread.
function slackThreadKey(channel: string, threadTs: string): string {
  return `${channel}:${threadTs}`
}

function registerHandlers(bot: SlackChat): void {
  bot.onNewMention(async (thread, message) => {
    await thread.subscribe()
    await handleSlackMessage({ thread, message, kind: 'channel' })
  })

  bot.onDirectMessage(async (thread, message) => {
    await thread.subscribe()
    await handleSlackMessage({ thread, message, kind: 'dm' })
  })

  bot.onSubscribedMessage(async (thread, message) => {
    // Reuse the routing kind captured when the thread subscription started.
    await handleSlackMessage({
      thread,
      message,
      kind: thread.isDM ? 'dm' : 'channel',
    })
  })
}

function extractTeamId(message: SlackMessage): string {
  const raw = message.raw as SlackRawMessage | undefined
  return extractSlackTeamId(raw)
}

async function handleSlackMessage(input: {
  thread: SlackThread
  message: SlackMessage
  kind: 'channel' | 'dm'
}): Promise<void> {
  const { thread, message, kind } = input
  const text = message.text?.trim()
  if (!text) {
    return
  }

  // Keep provider-native Slack ids out of routing keys; `slack:`-prefixed SDK
  // ids should not leak into shared channel bindings.
  const slackThread = extractSlackThread(
    thread,
    message.raw as SlackRawMessage | undefined
  )
  if (!slackThread) {
    console.warn('[slack] thread missing slack ids; skipping', {
      channelId: thread.channelId,
      threadId: thread.id,
    })
    return
  }
  const { channelId, threadTs } = slackThread
  const messageTs = (message.raw as SlackRawMessage | undefined)?.ts ?? threadTs

  const teamId = extractTeamId(message)
  if (!teamId) {
    console.warn(
      '[slack] dropping event with no team id; cannot owner-scope to an installation',
      { channelId, kind }
    )
    return
  }

  const externalRoutingKey =
    kind === 'dm' ? (message.author?.userId ?? channelId) : channelId

  const incoming: IncomingChannelMessage = {
    channel: 'slack',
    teamId,
    externalThreadKey: slackThreadKey(channelId, threadTs),
    externalRoutingKey,
    externalRoutingKind: kind,
    externalUserId: message.author?.userId ?? 'unknown',
    externalUserDisplayName:
      message.author?.fullName ?? message.author?.userName,
    text,
    threadMetadata: {
      slackChannel: channelId,
      slackMessageTs: messageTs,
      slackThreadTs: threadTs,
      slackTeamId: teamId,
    },
    loadModelMessages: () => collectThreadHistory(thread),
  }

  const handled = await runChannelChatTurn({
    message: incoming,
    sink: {
      postReply: async (content) => {
        // The adapter throttles `chat.update` internally for streaming replies.
        await thread.post(content)
      },
      postError: async (errorText) => {
        await thread.post(errorText)
      },
      startTyping: async (status) => {
        await thread.startTyping(status)
      },
    },
  })

  if (!handled) {
    console.warn('[slack] no agent binding for incoming message', {
      channelId,
      teamId,
      kind,
      routingKey: externalRoutingKey,
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
