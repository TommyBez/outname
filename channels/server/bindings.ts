import 'server-only'
import { and, eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { db } from '@/shared/db'
import {
  type AgentChannelBinding,
  agent,
  agentChannelBindings,
} from '@/shared/db/schema'
import type { ChannelId } from './types'

type BindingKind = 'channel' | 'dm' | 'default'

/**
 * Idempotent upsert for agent ⇄ channel routing rows.
 *
 * The unique index on `(channel, teamId, externalKey, kind, userId)`
 * enforces that within a single platform user, a workspace cannot
 * bind two agents to the same channel/DM at once. Different users may
 * each have their own binding for the same channel; the resolver fans
 * out to all of them at webhook time.
 *
 * Pass `teamId: ''` only for channels that have no workspace concept
 * (dev-only single-workspace mode).
 */
export async function upsertAgentChannelBinding(input: {
  agentId: string
  channel: ChannelId
  teamId: string
  externalKey: string
  kind: BindingKind
  metadata?: Record<string, unknown>
}): Promise<AgentChannelBinding> {
  const id = `acb_${nanoid(12)}`
  const metadata = input.metadata ?? {}

  const [agentRow] = await db
    .select({ userId: agent.userId })
    .from(agent)
    .where(eq(agent.id, input.agentId))
    .limit(1)
  if (!agentRow) {
    throw new Error(
      `upsertAgentChannelBinding: agent ${input.agentId} not found`
    )
  }
  const userId = agentRow.userId

  await db
    .insert(agentChannelBindings)
    .values({
      id,
      userId,
      agentId: input.agentId,
      channel: input.channel,
      teamId: input.teamId,
      externalKey: input.externalKey,
      kind: input.kind,
      metadata,
    })
    .onConflictDoUpdate({
      target: [
        agentChannelBindings.channel,
        agentChannelBindings.teamId,
        agentChannelBindings.externalKey,
        agentChannelBindings.kind,
        agentChannelBindings.userId,
      ],
      set: {
        agentId: input.agentId,
        metadata,
        updatedAt: new Date(),
      },
    })

  const [row] = await db
    .select()
    .from(agentChannelBindings)
    .where(
      and(
        eq(agentChannelBindings.channel, input.channel),
        eq(agentChannelBindings.teamId, input.teamId),
        eq(agentChannelBindings.externalKey, input.externalKey),
        eq(agentChannelBindings.kind, input.kind),
        eq(agentChannelBindings.userId, userId)
      )
    )
    .limit(1)
  if (!row) {
    throw new Error(
      `upsertAgentChannelBinding: row missing after upsert (${input.channel}/${input.teamId}/${input.kind}/${input.externalKey})`
    )
  }
  return row
}

export async function deleteAgentChannelBinding(input: {
  userId: string
  channel: ChannelId
  teamId: string
  externalKey: string
  kind: BindingKind
}): Promise<void> {
  await db
    .delete(agentChannelBindings)
    .where(
      and(
        eq(agentChannelBindings.userId, input.userId),
        eq(agentChannelBindings.channel, input.channel),
        eq(agentChannelBindings.teamId, input.teamId),
        eq(agentChannelBindings.externalKey, input.externalKey),
        eq(agentChannelBindings.kind, input.kind)
      )
    )
}

export async function listAgentChannelBindings(
  agentId: string
): Promise<AgentChannelBinding[]> {
  return await db
    .select()
    .from(agentChannelBindings)
    .where(eq(agentChannelBindings.agentId, agentId))
}
