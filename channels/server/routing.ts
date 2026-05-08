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
import { getChannelInstallationsByTeam } from './installations'
import type { ChannelId, ChannelRoute, IncomingChannelMessage } from './types'

/**
 * Resolve which agents should handle this thread.
 *
 * Multi-user contract — for owner-scoped channels, the resolver:
 *   1. Reads every `channel_installations` row for the workspace.
 *      Several platform users may have installed the same Slack
 *      workspace; each one is a candidate for fan-out.
 *   2. For each installing user, looks up a binding (by sticky thread
 *      mapping → direct binding → workspace-default binding) scoped
 *      by `userId`.
 *   3. Returns every (user, agent) pair that matched. Callers run a
 *      chat turn per agent.
 *
 * Channels that intentionally route with `teamId = ''` (dev-only
 * single-workspace mode) skip the installation lookup and return at
 * most one agent. The Slack bot refuses to boot in this mode in
 * production (see `channels/slack/server/bot.ts`).
 */
export async function resolveAgentsForIncomingMessage(
  msg: IncomingChannelMessage
): Promise<Agent[]> {
  if (!msg.teamId) {
    const single = await findCandidateAgentForUser(msg, null)
    return single ? [single] : []
  }

  const installations = await getChannelInstallationsByTeam(
    msg.channel,
    msg.teamId
  )
  if (installations.length === 0) {
    return []
  }

  const agents: Agent[] = []
  const seen = new Set<string>()
  for (const install of installations) {
    const candidate = await findCandidateAgentForUser(msg, install.userId)
    if (candidate && !seen.has(candidate.id)) {
      seen.add(candidate.id)
      agents.push(candidate)
    }
  }
  return agents
}

async function findCandidateAgentForUser(
  msg: IncomingChannelMessage,
  userId: string | null
): Promise<Agent | null> {
  // Sticky thread mapping wins if the user already has a conversation
  // for this external thread.
  const mappingFilters = [
    eq(channelThreadConversations.channel, msg.channel),
    eq(channelThreadConversations.teamId, msg.teamId),
    eq(channelThreadConversations.externalThreadKey, msg.externalThreadKey),
  ]
  if (userId) {
    mappingFilters.push(eq(channelThreadConversations.userId, userId))
  }
  const existingMapping = await db
    .select({ agentId: channelThreadConversations.agentId })
    .from(channelThreadConversations)
    .where(and(...mappingFilters))
    .limit(1)
  if (existingMapping[0]) {
    const candidate = await loadAgent(existingMapping[0].agentId)
    if (candidate && (!userId || candidate.userId === userId)) {
      return candidate
    }
  }

  const direct = await findBinding({
    channel: msg.channel,
    teamId: msg.teamId,
    externalKey: msg.externalRoutingKey,
    kind: msg.externalRoutingKind,
    userId,
  })
  if (direct) {
    return await loadAgent(direct.agentId)
  }

  const fallback = await findBinding({
    channel: msg.channel,
    teamId: msg.teamId,
    externalKey: '',
    kind: 'default',
    userId,
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
  userId: string | null
}) {
  const filters = [
    eq(agentChannelBindings.channel, input.channel),
    eq(agentChannelBindings.teamId, input.teamId),
    eq(agentChannelBindings.externalKey, input.externalKey),
    eq(agentChannelBindings.kind, input.kind),
  ]
  if (input.userId) {
    filters.push(eq(agentChannelBindings.userId, input.userId))
  }
  const [row] = await db
    .select({ agentId: agentChannelBindings.agentId })
    .from(agentChannelBindings)
    .where(and(...filters))
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
 * thread for a specific agent. The mapping in
 * `channel_thread_conversations` is unique on
 * `(channel, teamId, externalThreadKey, agentId)` so each agent owns
 * its own conversation for the thread, and concurrent webhooks for
 * the same Slack thread converge on the same conversation row.
 *
 * Race-condition contract: two simultaneous webhooks for the same
 * brand new thread will each call `getOrCreateConversationForAgent`
 * with a freshly generated `chat_conversation` id, so each side ends
 * up having created a distinct row. Only one wins the
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
        ),
        eq(channelThreadConversations.agentId, agentRow.id)
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
      userId: agentRow.userId,
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
        channelThreadConversations.agentId,
      ],
    })
    .returning({
      conversationId: channelThreadConversations.conversationId,
    })

  if (inserted[0]) {
    return { agent: agentRow, conversationId: inserted[0].conversationId }
  }

  // Lost the race: another concurrent webhook already wrote the canonical
  // mapping for this thread + agent. Re-read it so the caller persists
  // its user message against the winning conversation, and drop our
  // orphan chat_conversation row (cascade FKs handle anything that might
  // have landed in it).
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
        ),
        eq(channelThreadConversations.agentId, agentRow.id)
      )
    )
    .limit(1)
  if (!canonical) {
    throw new Error(
      `channel_thread_conversations row missing after conflict (${message.channel}/${message.teamId}/${message.externalThreadKey}/${agentRow.id})`
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
