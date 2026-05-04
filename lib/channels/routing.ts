import 'server-only'
import { and, eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import {
  getOrCreateConversationForAgent,
  newChatConversationId,
} from '@/lib/agent-chat'
import { db } from '@/lib/db'
import {
  type Agent,
  agent,
  agentChannelBindings,
  channelThreadConversations,
} from '@/lib/db/schema'
import type { ChannelId, ChannelRoute, IncomingChannelMessage } from './types'

/**
 * Resolve which agent owns this thread.
 *
 * Lookup order:
 *   1. Existing `channel_thread_conversations` row — the thread already
 *      mapped to a specific agent on a previous turn, so we always
 *      route back to the same agent.
 *   2. `agent_channel_bindings` row matching the routing key (Slack
 *      channel id for channel posts, Slack user id for DMs).
 *   3. `agent_channel_bindings` row with `kind='default'` — the
 *      single-operator fallback so a fresh deployment can answer
 *      messages with no per-channel binding work.
 *
 * Returns `null` when nothing matches; the adapter should silently drop
 * the event in that case so the bot doesn't reply to unrelated chatter.
 */
export async function resolveAgentForIncomingMessage(
  msg: IncomingChannelMessage
): Promise<Agent | null> {
  const existingMapping = await db
    .select({ agentId: channelThreadConversations.agentId })
    .from(channelThreadConversations)
    .where(
      and(
        eq(channelThreadConversations.channel, msg.channel),
        eq(channelThreadConversations.externalThreadKey, msg.externalThreadKey)
      )
    )
    .limit(1)
  if (existingMapping[0]) {
    return await loadAgent(existingMapping[0].agentId)
  }

  const direct = await findBinding(
    msg.channel,
    msg.externalRoutingKey,
    msg.externalRoutingKind
  )
  if (direct) {
    return await loadAgent(direct.agentId)
  }

  const fallback = await findBinding(msg.channel, '', 'default')
  if (fallback) {
    return await loadAgent(fallback.agentId)
  }
  return null
}

async function findBinding(
  channel: ChannelId,
  externalKey: string,
  kind: 'channel' | 'dm' | 'default'
) {
  const [row] = await db
    .select({ agentId: agentChannelBindings.agentId })
    .from(agentChannelBindings)
    .where(
      and(
        eq(agentChannelBindings.channel, channel),
        eq(agentChannelBindings.externalKey, externalKey),
        eq(agentChannelBindings.kind, kind)
      )
    )
    .limit(1)
  return row ?? null
}

async function loadAgent(agentId: string): Promise<Agent | null> {
  const [row] = await db
    .select()
    .from(agent)
    .where(eq(agent.id, agentId))
    .limit(1)
  return row ?? null
}

/**
 * Find or create the `chat_conversation` row that backs this external
 * thread. The mapping in `channel_thread_conversations` is a unique
 * index on `(channel, externalThreadKey)` so concurrent webhooks for
 * the same Slack thread converge on the same conversation row.
 */
export async function ensureConversationForThread(input: {
  agent: Agent
  message: IncomingChannelMessage
}): Promise<ChannelRoute> {
  const { agent: agentRow, message } = input

  const existing = await db
    .select()
    .from(channelThreadConversations)
    .where(
      and(
        eq(channelThreadConversations.channel, message.channel),
        eq(
          channelThreadConversations.externalThreadKey,
          message.externalThreadKey
        )
      )
    )
    .limit(1)
  if (existing[0]) {
    return { agent: agentRow, conversationId: existing[0].conversationId }
  }

  const conversationId = newChatConversationId()
  const conversation = await getOrCreateConversationForAgent(
    conversationId,
    agentRow.id
  )
  if (!conversation) {
    throw new Error(
      `Failed to create conversation for agent ${agentRow.id} (channel=${message.channel})`
    )
  }

  await db
    .insert(channelThreadConversations)
    .values({
      id: `ctc_${nanoid(12)}`,
      channel: message.channel,
      externalThreadKey: message.externalThreadKey,
      conversationId: conversation.id,
      agentId: agentRow.id,
      metadata: message.threadMetadata ?? {},
    })
    .onConflictDoNothing({
      target: [
        channelThreadConversations.channel,
        channelThreadConversations.externalThreadKey,
      ],
    })

  return { agent: agentRow, conversationId: conversation.id }
}
