'use server'

import { and, eq } from 'drizzle-orm'
import { revalidatePath, revalidateTag } from 'next/cache'
import { z } from 'zod'
import { requireUserId } from '@/auth/server/auth-guard'
import {
  deleteAgentChannelBinding,
  upsertAgentChannelBinding,
} from '@/channels/server/bindings'
import { getChannelInstallationsForUser } from '@/channels/server/installations'
import { deleteSlackInstallation } from '@/channels/slack/server/installations'
import { db } from '@/shared/db'
import { agentChannelBindings } from '@/shared/db/schema'
import { agentTag } from '@/shared/server/cache-tags'
import { getAgentByIdForUser } from '@/shared/server/data'

interface ActionResult {
  error?: string
  ok: boolean
}

const bindingKindSchema = z.enum(['channel', 'dm'])

const upsertSchema = z
  .object({
    agentId: z.string().min(1),
    teamId: z.string().min(1),
    kind: bindingKindSchema,
    externalKey: z.string().trim(),
  })
  .superRefine((value, ctx) => {
    if (!value.externalKey) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['externalKey'],
        message:
          value.kind === 'channel'
            ? 'Channel id is required (e.g. C0123456789).'
            : 'Slack user id is required (e.g. U0123456789).',
      })
    }
  })

/**
 * Owner-scoped checks for binding mutations:
 *   1. The target agent must belong to the active user.
 *   2. The (channel, teamId) install must also belong to the active
 *      user — otherwise we'd let one operator route messages from a
 *      workspace they don't own.
 */
async function assertOwnsAgentAndWorkspace(input: {
  userId: string
  agentId: string
  teamId: string
}): Promise<ActionResult | null> {
  const agent = await getAgentByIdForUser(input.agentId, input.userId)
  if (!agent) {
    return { ok: false, error: 'Agent not found.' }
  }
  if (!input.teamId) {
    return {
      ok: false,
      error: 'A Slack workspace is required.',
    }
  }
  const installs = await getChannelInstallationsForUser(input.userId, 'slack')
  const owns = installs.some((row) => row.externalId === input.teamId)
  if (!owns) {
    return {
      ok: false,
      error: 'You have not installed the Slack app in that workspace.',
    }
  }
  return null
}

export async function upsertSlackBindingAction(input: {
  agentId: string
  teamId: string
  kind: 'channel' | 'dm'
  externalKey: string
}): Promise<ActionResult> {
  const userId = await requireUserId()

  const parsed = upsertSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid input.',
    }
  }

  const guard = await assertOwnsAgentAndWorkspace({
    userId,
    agentId: parsed.data.agentId,
    teamId: parsed.data.teamId,
  })
  if (guard) {
    return guard
  }

  await upsertAgentChannelBinding({
    agentId: parsed.data.agentId,
    channel: 'slack',
    teamId: parsed.data.teamId,
    externalKey: parsed.data.externalKey,
    kind: parsed.data.kind,
  })

  revalidateTag(agentTag(parsed.data.agentId), 'max')
  return { ok: true }
}

export async function deleteSlackBindingAction(input: {
  agentId: string
  bindingId: string
}): Promise<ActionResult> {
  const userId = await requireUserId()
  const agent = await getAgentByIdForUser(input.agentId, userId)
  if (!agent) {
    return { ok: false, error: 'Agent not found.' }
  }

  // Look up the binding by id but require it to belong to the agent we
  // just owner-scoped — that prevents a forged bindingId from a
  // different user's row from being deleted via this action.
  const [row] = await db
    .select()
    .from(agentChannelBindings)
    .where(
      and(
        eq(agentChannelBindings.id, input.bindingId),
        eq(agentChannelBindings.agentId, input.agentId)
      )
    )
    .limit(1)

  if (!row) {
    return { ok: false, error: 'Binding not found.' }
  }

  await deleteAgentChannelBinding({
    userId,
    channel: 'slack',
    teamId: row.teamId,
    externalKey: row.externalKey,
    kind: row.kind,
  })

  revalidateTag(agentTag(input.agentId), 'max')
  return { ok: true }
}

export async function disconnectSlackInstallationAction(input: {
  teamId: string
}): Promise<ActionResult> {
  const userId = await requireUserId()
  if (!input.teamId) {
    return { ok: false, error: 'teamId is required.' }
  }

  // Bindings for the workspace stay in place — they become inert because
  // the dispatcher requires an active install — but we surface this in
  // the UI so the operator knows the workspace was disconnected.
  await deleteSlackInstallation({ userId, teamId: input.teamId })
  revalidatePath('/channels')
  return { ok: true }
}
