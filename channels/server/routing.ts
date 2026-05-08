import 'server-only'
import { and, eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import {
  getOrCreateConversationForAgent,
  newChatConversationId,
} from '@/chat/server/chat'
import { db } from '@/shared/db'
import {
  type Agent,
  agent,
  agentChannelBindings,
  channelThreadConversations,
  chatConversation,
} from '@/shared/db/schema'
import { getChannelInstallationByTeam } from './installations'
import type { ChannelId, ChannelRoute, IncomingChannelMessage } from './types'

/**
 * Resolve which agent owns this thread.
 *
 * Multi-user safety contract — for owner-scoped channels, the resolver
 * returns null unless ALL of:
 *   - the workspace has a matching `channel_installations` row
 *     (otherwise this isn't an installed workspace and we never reply);
 *   - the matched binding (or sticky thread mapping) points at an
 *     agent whose `agent.userId` equals the installation's `userId`
 *     (otherwise a misconfigured binding cannot leak across users).
 *
 * Channels that intentionally route with `teamId = ''` (Slack
 * single-workspace mode, or future channels with no workspace concept)
 * bypass the installation lookup entirely. In that sentinel mode there
 * is no per-workspace install row and no cross-user owner check.
 *
 * Lookup order — each step still requires the owner check above:
 *   1. Existing `channel_thread_conversations` row keyed by
 *      `(channel, teamId, externalThreadKey)`.
 *   2. `agent_channel_bindings` row matching the routing key (Slack
 *      channel id for channel posts, Slack user id for DMs).
 *   3. `agent_channel_bindings` row with `kind='default'` — the
 *      per-workspace fallback, scoped to the same team.
 */
export async function resolveAgentForIncomingMessage(
  msg: IncomingChannelMessage
): Promise<Agent | null> {
  const candidate = await findCandidateAgent(msg)
  if (!candidate) {
    return null
  }

  if (!msg.teamId) {
    return candidate
  }

  const installation = await getChannelInstallationByTeam(
    msg.channel,
    msg.teamId
  )
  if (!installation) {
    return null
  }
  if (candidate.userId !== installation.userId) {
    console.warn('[channels] dropping cross-user routing attempt', {
      channel: msg.channel,
      teamId: msg.teamId,
      installationUserId: installation.userId,
      agentId: candidate.id,
      agentUserId: candidate.userId,
    })
    return null
  }
  return candidate
}

async function findCandidateAgent(
  msg: IncomingChannelMessage
): Promise<Agent | null> {
  const existingMapping = await db
    .select({ agentId: channelThreadConversations.agentId })
    .from(channelThreadConversations)
    .where(
      and(
        eq(channelThreadConversations.channel, msg.channel),
        eq(channelThreadConversations.teamId, msg.teamId),
        eq(channelThreadConversations.externalThreadKey, msg.externalThreadKey)
      )
    )
    .limit(1)
  if (existingMapping[0]) {
    return await loadAgent(existingMapping[0].agentId)
  }

  const direct = await findBinding({
    channel: msg.channel,
    teamId: msg.teamId,
    externalKey: msg.externalRoutingKey,
    kind: msg.externalRoutingKind,
  })
  if (direct) {
    return await loadAgent(direct.agentId)
  }

  const fallback = await findBinding({
    channel: msg.channel,
    teamId: msg.teamId,
    externalKey: '',
    kind: 'default',
  })
  if (fallback) {
    return await loadAgent(fallback.agentId)
  }
  return null
}

async function findBinding(input: {
  channel: ChannelId
  teamId: string
  externalKey: string
  kind: 'channel' | 'dm' | 'default'
}) {
  const [row] = await db
    .select({ agentId: agentChannelBindings.agentId })
    .from(agentChannelBindings)
    .where(
      and(
        eq(agentChannelBindings.channel, input.channel),
        eq(agentChannelBindings.teamId, input.teamId),
        eq(agentChannelBindings.externalKey, input.externalKey),
        eq(agentChannelBindings.kind, input.kind)
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
 * thread. The mapping in `channel_thread_conversations` is unique on
 * `(channel, teamId, externalThreadKey)` so concurrent webhooks for the
 * same Slack thread converge on the same conversation row even across
 * workspaces that happen to share a thread key string.
 *
 * Race-condition contract: two simultaneous webhooks for the same brand
 * new Slack thread will each call `getOrCreateConversationForAgent` with
 * a freshly generated `chat_conversation` id, so each side ends up
 * having created a distinct row. Only one wins the
 * `channel_thread_conversations` unique-index race; we always re-read
 * the canonical mapping after the insert and return its
 * `conversationId`. The losing side's `chat_conversation` row would
 * otherwise leak — we drop it in a best-effort cleanup so the only
 * persisted artefact is the winner's conversation.
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
        eq(channelThreadConversations.teamId, message.teamId),
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

  const inserted = await db
    .insert(channelThreadConversations)
    .values({
      id: `ctc_${nanoid(12)}`,
      channel: message.channel,
      teamId: message.teamId,
      externalThreadKey: message.externalThreadKey,
      conversationId: conversation.id,
      agentId: agentRow.id,
      metadata: message.threadMetadata ?? {},
    })
    .onConflictDoNothing({
      target: [
        channelThreadConversations.channel,
        channelThreadConversations.teamId,
        channelThreadConversations.externalThreadKey,
      ],
    })
    .returning({
      conversationId: channelThreadConversations.conversationId,
    })

  if (inserted[0]) {
    return { agent: agentRow, conversationId: inserted[0].conversationId }
  }

  // Lost the race: another concurrent webhook already wrote the canonical
  // mapping for this thread. Re-read it so the caller persists its user
  // message against the winning conversation, and drop our orphan
  // chat_conversation row (cascade FKs handle anything that might have
  // landed in it).
  const [canonical] = await db
    .select({
      conversationId: channelThreadConversations.conversationId,
    })
    .from(channelThreadConversations)
    .where(
      and(
        eq(channelThreadConversations.channel, message.channel),
        eq(channelThreadConversations.teamId, message.teamId),
        eq(
          channelThreadConversations.externalThreadKey,
          message.externalThreadKey
        )
      )
    )
    .limit(1)
  if (!canonical) {
    throw new Error(
      `channel_thread_conversations row missing after conflict (${message.channel}/${message.teamId}/${message.externalThreadKey})`
    )
  }

  try {
    await db
      .delete(chatConversation)
      .where(eq(chatConversation.id, conversation.id))
  } catch (err) {
    console.warn(
      '[channels] failed to clean up orphan chat_conversation after thread race',
      { conversationId: conversation.id, err }
    )
  }

  return { agent: agentRow, conversationId: canonical.conversationId }
}
