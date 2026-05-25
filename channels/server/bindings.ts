import 'server-only'
import { and, eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { db } from '@/shared/db/pool'
import {
  type AgentChannelBinding,
  agent,
  agentChannelBindings,
} from '@/shared/db/schema'
import type { ChannelId } from './types'

type BindingKind = 'channel' | 'dm'

// The unique key is per user, so one operator can only bind a workspace thread once
// while different users can still fan out from the same Slack workspace.
export async function upsertAgentChannelBinding(input: {
  agentId: string
  channel: ChannelId
  externalScopeId: string
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
      externalScopeId: input.externalScopeId,
      externalKey: input.externalKey,
      kind: input.kind,
      metadata,
    })
    .onConflictDoUpdate({
      target: [
        agentChannelBindings.channel,
        agentChannelBindings.externalScopeId,
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
        eq(agentChannelBindings.externalScopeId, input.externalScopeId),
        eq(agentChannelBindings.externalKey, input.externalKey),
        eq(agentChannelBindings.kind, input.kind),
        eq(agentChannelBindings.userId, userId)
      )
    )
    .limit(1)
  if (!row) {
    throw new Error(
      `upsertAgentChannelBinding: row missing after upsert (${input.channel}/${input.externalScopeId}/${input.kind}/${input.externalKey})`
    )
  }
  return row
}

export async function deleteAgentChannelBinding(input: {
  userId: string
  channel: ChannelId
  externalScopeId: string
  externalKey: string
  kind: BindingKind
}): Promise<void> {
  await db
    .delete(agentChannelBindings)
    .where(
      and(
        eq(agentChannelBindings.userId, input.userId),
        eq(agentChannelBindings.channel, input.channel),
        eq(agentChannelBindings.externalScopeId, input.externalScopeId),
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
