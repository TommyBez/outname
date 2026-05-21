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
  type ChannelInstallation,
  channelThreadConversations,
  chatConversation,
} from '@/shared/db/schema'
import { getChannelInstallationsByTeam } from './installations'
import type { ChannelId, ChannelRoute, IncomingChannelMessage } from './types'

export interface ResolvedChannelRoute {
  agent: Agent
  installationCreatedAt: Date
  installationUserId: string
}

// Resolve every agent that should receive this incoming thread. Multiple app
// users may have installed the same workspace, so fan-out is scoped by
// installation owner and then by that owner's binding.
export async function resolveRoutesForIncomingMessage(
  msg: IncomingChannelMessage
): Promise<ResolvedChannelRoute[]> {
  if (!msg.teamId) {
    return []
  }

  const installations = await getChannelInstallationsByTeam(
    msg.channel,
    msg.teamId
  )
  if (installations.length === 0) {
    return []
  }

  const routes: ResolvedChannelRoute[] = []
  const seen = new Set<string>()
  for (const install of installations) {
    const candidate = await findCandidateAgentForUser(msg, install.userId)
    if (candidate && !seen.has(candidate.id)) {
      seen.add(candidate.id)
      routes.push({
        agent: candidate,
        installationCreatedAt: install.createdAt,
        installationUserId: install.userId,
      })
    }
  }
  return routes.sort(compareResolvedRoutes)
}

export async function resolveAgentsForIncomingMessage(
  msg: IncomingChannelMessage
): Promise<Agent[]> {
  const routes = await resolveRoutesForIncomingMessage(msg)
  return routes.map((route) => route.agent)
}

function compareResolvedRoutes(
  left: ResolvedChannelRoute,
  right: ResolvedChannelRoute
): number {
  const createdDelta =
    left.installationCreatedAt.getTime() - right.installationCreatedAt.getTime()
  if (createdDelta !== 0) {
    return createdDelta
  }
  const userDelta = left.installationUserId.localeCompare(
    right.installationUserId
  )
  if (userDelta !== 0) {
    return userDelta
  }
  return left.agent.id.localeCompare(right.agent.id)
}

async function findCandidateAgentForUser(
  msg: IncomingChannelMessage,
  userId: string
): Promise<Agent | null> {
  // Sticky thread mapping wins when this user already owns the thread.
  const existingMapping = await db
    .select({ agentId: channelThreadConversations.agentId })
    .from(channelThreadConversations)
    .where(
      and(
        eq(channelThreadConversations.channel, msg.channel),
        eq(channelThreadConversations.teamId, msg.teamId),
        eq(channelThreadConversations.externalThreadKey, msg.externalThreadKey),
        eq(channelThreadConversations.userId, userId)
      )
    )
    .limit(1)
  if (existingMapping[0]) {
    const candidate = await loadAgent(existingMapping[0].agentId)
    if (candidate && candidate.userId === userId) {
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

  return null
}

async function findBinding(input: {
  channel: ChannelId
  teamId: string
  externalKey: string
  kind: 'channel' | 'dm'
  userId: string
}) {
  const [row] = await db
    .select({ agentId: agentChannelBindings.agentId })
    .from(agentChannelBindings)
    .where(
      and(
        eq(agentChannelBindings.channel, input.channel),
        eq(agentChannelBindings.teamId, input.teamId),
        eq(agentChannelBindings.externalKey, input.externalKey),
        eq(agentChannelBindings.kind, input.kind),
        eq(agentChannelBindings.userId, input.userId)
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

// Each agent owns one conversation per external thread. If two webhooks race to
// create it, re-read the canonical mapping after the insert conflict and
// best-effort delete the losing orphan conversation row.
export async function ensureConversationForThread(input: {
  agent: Agent
  installation?: ChannelInstallation | null
  installationCreatedAt?: Date
  installationUserId?: string
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
    return {
      agent: agentRow,
      conversationId: existing[0].conversationId,
      ...routeInstallationMetadata(input, agentRow),
    }
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
    return {
      agent: agentRow,
      conversationId: inserted[0].conversationId,
      ...routeInstallationMetadata(input, agentRow),
    }
  }

  // Another webhook won the unique-index race, so re-read the canonical
  // mapping and delete this orphan conversation row.
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

  return {
    agent: agentRow,
    conversationId: canonical.conversationId,
    ...routeInstallationMetadata(input, agentRow),
  }
}

function routeInstallationMetadata(
  input: {
    installation?: ChannelInstallation | null
    installationCreatedAt?: Date
    installationUserId?: string
  },
  agentRow: Agent
): Pick<ChannelRoute, 'installationCreatedAt' | 'installationUserId'> {
  return {
    installationCreatedAt:
      input.installationCreatedAt ??
      input.installation?.createdAt ??
      new Date(0),
    installationUserId:
      input.installationUserId ?? input.installation?.userId ?? agentRow.userId,
  }
}
