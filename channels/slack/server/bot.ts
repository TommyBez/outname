import 'server-only'
import { createSlackAdapter, type SlackAdapter } from '@chat-adapter/slack'
import { Chat } from 'chat'
import { runChannelChatTurn } from '@/channels/server/dispatch'
import type { IncomingChannelMessage } from '@/channels/server/types'
import { SlackHybridState } from './state'
import {
  extractSlackTeamId,
  extractSlackThread,
  type SlackRawMessage,
} from './thread-ids'

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
 * Boot requires `SLACK_CLIENT_ID` + `SLACK_CLIENT_SECRET` (multi-
 * workspace OAuth). The bot is installed per-user via
 * `/api/channels/slack/oauth/callback`, bot tokens are stored
 * encrypted in `channel_installations`, and the SDK resolves them
 * per-team via the `SlackHybridState` adapter. The webhook verifies
 * signatures using `SLACK_SIGNING_SECRET` (one Slack app, many
 * workspaces). Multiple platform users may install the same Slack
 * workspace; each user owns their own `agent_channel_bindings` rows
 * so an incoming message fans out to every user whose binding matches.
 *
 * Channel-agnostic logic — agent routing, conversation persistence,
 * workflow dispatch — lives in `lib/channels/dispatch.ts` so the same
 * pipeline can be reused for Teams / Discord / Telegram by adding a
 * new adapter file.
 *
 * Construction is lazy via `getSlackBot()` / `getSlackAdapter()` so the
 * bundle can be analysed at build time without `SLACK_SIGNING_SECRET`
 * available in the environment. The adapter's `createSlackAdapter`
 * call validates secrets at construction time, which would throw
 * during Next.js's "collect page data" step if it ran at module load.
 */

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
    /**
     * `SlackHybridState` keeps locks/subscriptions in the inner backing
     * adapter (Redis when `REDIS_URL` is set — see
     * `lib/channels/slack/backing-state.ts` — memory otherwise) and
     * routes Slack installation reads/writes into `channel_installations`
     * for per-user owner scoping. Set `REDIS_URL` for multi-instance
     * deployments so concurrency locks and thread subscriptions are
     * shared across processes.
     */
    state: new SlackHybridState(),
    /**
     * Drop overlapping messages on the same thread instead of queueing
     * them. Each turn already reserves the agent session workflow, so
     * concurrent processing of the same thread would just race the same
     * agent against itself.
     */
    concurrency: 'drop',
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

/**
 * Build a stable thread key for `channel_thread_conversations`. Slack
 * threads are uniquely identified by `channel` + `thread_ts`. For a
 * top-level message we use the message ts itself so direct replies (no
 * thread yet) round-trip as their own thread.
 */
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
    // Inside a subscribed thread Slack will deliver every human message.
    // Decide which routing kind to use from the channel hint set when we
    // first subscribed.
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

  // Emit provider-native Slack ids into the shared routing layer. The
  // fallback keeps existing behavior if the SDK ever omits raw payload
  // fields, but we do not want `slack:`-prefixed SDK ids to leak into
  // `agent_channel_bindings`.
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
      slackThreadTs: threadTs,
      slackTeamId: teamId,
    },
  }

  const handled = await runChannelChatTurn({
    message: incoming,
    sink: {
      postReply: async (content) => {
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
      teamId,
      kind,
      routingKey: externalRoutingKey,
    })
  }
}
