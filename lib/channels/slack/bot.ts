import 'server-only'
import { createSlackAdapter } from '@chat-adapter/slack'
import { createMemoryState } from '@chat-adapter/state-memory'
import { Chat } from 'chat'
import { runChannelChatTurn } from '../dispatch'
import type { IncomingChannelMessage } from '../types'

/**
 * Slack chat bot built on the Vercel Chat SDK.
 *
 * The SDK owns:
 *   - Slack signing-secret webhook verification
 *   - Slack API client + bot user id resolution
 *   - mrkdwn ↔ markdown conversion + Block Kit rendering
 *   - Mention detection on `@bot` posts
 *   - Optional streaming-edit posting (so the agent's response appears
 *     to "type" in the Slack thread)
 *
 * Channel-agnostic logic — agent routing, conversation persistence,
 * workflow dispatch — lives in `lib/channels/dispatch.ts` so the same
 * pipeline can be reused for Teams / Discord / Telegram by adding a new
 * adapter file.
 *
 * Notes:
 *   - The SDK requires a `StateAdapter` for thread subscriptions and
 *     concurrency locks. We use `createMemoryState()` so the integration
 *     ships without a Redis dependency. State is best-effort — we
 *     persist the canonical thread → conversation mapping in Postgres,
 *     so a cold start that drops in-memory state at most loses the
 *     "auto-reply to follow-ups" optimisation, not the conversation
 *     itself. Swap in `@chat-adapter/state-redis` to harden this for
 *     multi-instance deployments.
 *   - We deliberately do NOT call `bot.registerSingleton()` —
 *     deserialisation of Slack threads inside Vercel Workflow steps is
 *     not used today and would require an `initialize()` call before
 *     anything that touches `Chat.getSingleton()`.
 */
const userName = process.env.SLACK_BOT_USERNAME ?? 'assistant'

const slackAdapter = createSlackAdapter({
  userName,
})

export const slackBot = new Chat({
  userName,
  adapters: { slack: slackAdapter },
  state: createMemoryState(),
  /**
   * Drop overlapping messages on the same thread instead of queueing
   * them. Each turn already reserves the agent session workflow, so
   * concurrent processing of the same thread would just race the same
   * agent against itself.
   */
  concurrency: 'drop',
})

/**
 * Build a stable thread key for `channel_thread_conversations`. Slack
 * threads are uniquely identified by `channel` + `thread_ts`. For a
 * top-level message we use the message ts itself so direct replies (no
 * thread yet) round-trip as their own thread.
 */
function slackThreadKey(channel: string, threadTs: string): string {
  return `${channel}:${threadTs}`
}

slackBot.onNewMention(async (thread, message) => {
  await thread.subscribe()
  await handleSlackMessage({ thread, message, kind: 'channel' })
})

slackBot.onDirectMessage(async (thread, message) => {
  await thread.subscribe()
  await handleSlackMessage({ thread, message, kind: 'dm' })
})

slackBot.onSubscribedMessage(async (thread, message) => {
  // Inside a subscribed thread Slack will deliver every human message.
  // Decide which routing kind to use from the channel hint set when we
  // first subscribed.
  await handleSlackMessage({
    thread,
    message,
    kind: thread.isDM ? 'dm' : 'channel',
  })
})

type SlackThread = Parameters<Parameters<typeof slackBot.onNewMention>[0]>[0]
type SlackMessage = Parameters<Parameters<typeof slackBot.onNewMention>[0]>[1]

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

  // The Slack adapter packs `(channel, thread_ts)` into the serialized
  // thread payload but `thread.channelId` / `thread.id` always expose
  // them as plain strings, which is what we use as the canonical thread
  // key in `channel_thread_conversations`.
  const channelId = thread.channelId
  const threadTs = thread.id
  if (!(channelId && threadTs)) {
    console.warn('[slack] thread missing slack ids; skipping', {
      channelId,
      threadTs,
    })
    return
  }

  const externalRoutingKey =
    kind === 'dm' ? (message.author?.userId ?? channelId) : channelId

  const incoming: IncomingChannelMessage = {
    channel: 'slack',
    externalThreadKey: slackThreadKey(channelId, threadTs),
    externalRoutingKey,
    externalRoutingKind: kind,
    externalUserId: message.author?.userId ?? 'unknown',
    externalUserDisplayName:
      message.author?.fullName ?? message.author?.userName,
    text,
    threadMetadata: {
      slackChannel: channelId,
      slackThreadTs: threadTs,
      slackTeamId: (message.raw as { team_id?: string; team?: string })
        ?.team_id,
    },
  }

  const handled = await runChannelChatTurn({
    message: incoming,
    sink: {
      postReply: async (content) => {
        if (typeof content === 'string') {
          await thread.post(content)
          return
        }
        // The Slack adapter uses `chat.update` between deltas to give
        // the impression of a streaming response — the SDK throttles
        // updates internally so we don't need to manage rate limits
        // ourselves.
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
      kind,
      routingKey: externalRoutingKey,
    })
  }
}
