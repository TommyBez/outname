import 'server-only'
import { and, eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { db } from '@/shared/db'
import {
  type AgentChannelBinding,
  agentChannelBindings,
} from '@/shared/db/schema'
import type { ChannelId } from './types'

type BindingKind = 'channel' | 'dm' | 'default'

/**
 * Idempotent upsert for agent ⇄ channel routing rows. Used today by
 * server-side scripts and the docs walkthrough; a settings UI can call
 * the same helper later.
 *
 * The unique index on `(channel, teamId, externalKey, kind)` enforces
 * that a single Slack workspace cannot bind two agents to the same
 * channel/DM at once — the second call updates the existing row in
 * place. Different workspaces (`teamId`) routing the same channel id
 * to different agents is allowed because each user owns their own
 * workspace install.
 *
 * Pass `teamId: ''` only for channels that have no workspace concept
 * (legacy single-tenant deployments). Multi-user deployments must pass
 * the Slack team id (or equivalent) so owner-scope checks in
 * `resolveAgentForIncomingMessage` succeed.
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

  await db
    .insert(agentChannelBindings)
    .values({
      id,
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
        eq(agentChannelBindings.kind, input.kind)
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
  channel: ChannelId
  teamId: string
  externalKey: string
  kind: BindingKind
}): Promise<void> {
  await db
    .delete(agentChannelBindings)
    .where(
      and(
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
