import 'server-only'
import { and, eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { db } from '@/lib/db'
import { type AgentChannelBinding, agentChannelBindings } from '@/lib/db/schema'
import type { ChannelId } from './types'

type BindingKind = 'channel' | 'dm' | 'default'

/**
 * Idempotent upsert for agent ⇄ channel routing rows. Used today by
 * server-side scripts and the docs walkthrough; a settings UI can call
 * the same helper later.
 *
 * The unique index on `(channel, externalKey, kind)` enforces that one
 * Slack channel cannot be bound to two agents simultaneously — the
 * second call updates the existing row in-place.
 */
export async function upsertAgentChannelBinding(input: {
  agentId: string
  channel: ChannelId
  externalKey: string
  kind: BindingKind
  metadata?: Record<string, unknown>
}): Promise<AgentChannelBinding> {
  const id = `acb_${nanoid(12)}`
  const metadata = input.metadata ?? {}

  await db
    .insert(agentChannelBindings)
    .values({
      id,
      agentId: input.agentId,
      channel: input.channel,
      externalKey: input.externalKey,
      kind: input.kind,
      metadata,
    })
    .onConflictDoUpdate({
      target: [
        agentChannelBindings.channel,
        agentChannelBindings.externalKey,
        agentChannelBindings.kind,
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
        eq(agentChannelBindings.externalKey, input.externalKey),
        eq(agentChannelBindings.kind, input.kind)
      )
    )
    .limit(1)
  if (!row) {
    throw new Error(
      `upsertAgentChannelBinding: row missing after upsert (${input.channel}/${input.kind}/${input.externalKey})`
    )
  }
  return row
}

export async function deleteAgentChannelBinding(input: {
  channel: ChannelId
  externalKey: string
  kind: BindingKind
}): Promise<void> {
  await db
    .delete(agentChannelBindings)
    .where(
      and(
        eq(agentChannelBindings.channel, input.channel),
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
