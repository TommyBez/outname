'use server'

import { and, eq } from 'drizzle-orm'
import { revalidatePath, revalidateTag } from 'next/cache'
import { z } from 'zod'
import { requireUserId } from '@/auth/server/auth-guard'
import { deleteDiscordGuildInstallation } from '@/channels/discord/server/installations'
import {
  deleteAgentChannelBinding,
  upsertAgentChannelBinding,
} from '@/channels/server/bindings'
import { getChannelInstallationsForUser } from '@/channels/server/installations'
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
    externalKey: z.string().trim(),
    externalScopeId: z.string().trim().min(1),
    kind: bindingKindSchema,
  })
  .superRefine((value, ctx) => {
    if (
      value.kind === 'channel' &&
      !value.externalScopeId.startsWith('guild:')
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['externalScopeId'],
        message: 'Discord channel bindings require a guild installation.',
      })
    }
    if (value.kind === 'dm' && !value.externalScopeId.startsWith('user:')) {
      ctx.addIssue({
        code: 'custom',
        path: ['externalScopeId'],
        message: 'Discord DM bindings require a linked Discord user.',
      })
    }
    if (!value.externalKey) {
      ctx.addIssue({
        code: 'custom',
        path: ['externalKey'],
        message:
          value.kind === 'channel'
            ? 'Discord channel id is required.'
            : 'Discord user id is required.',
      })
    }
  })

async function assertOwnsAgentAndDiscordScope(input: {
  agentId: string
  externalScopeId: string
  userId: string
}): Promise<ActionResult | null> {
  const agent = await getAgentByIdForUser(input.agentId, input.userId)
  if (!agent) {
    return { ok: false, error: 'Agent not found.' }
  }
  const installs = await getChannelInstallationsForUser(input.userId, 'discord')
  const owns = installs.some((row) => row.externalId === input.externalScopeId)
  if (!owns) {
    return {
      ok: false,
      error: 'You have not installed or linked that Discord scope.',
    }
  }
  return null
}

export async function upsertDiscordBindingAction(input: {
  agentId: string
  externalKey: string
  externalScopeId: string
  kind: 'channel' | 'dm'
}): Promise<ActionResult> {
  const userId = await requireUserId()
  const parsed = upsertSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid input.',
    }
  }

  const guard = await assertOwnsAgentAndDiscordScope({
    agentId: parsed.data.agentId,
    externalScopeId: parsed.data.externalScopeId,
    userId,
  })
  if (guard) {
    return guard
  }

  await upsertAgentChannelBinding({
    agentId: parsed.data.agentId,
    channel: 'discord',
    externalKey: parsed.data.externalKey,
    externalScopeId: parsed.data.externalScopeId,
    kind: parsed.data.kind,
  })

  revalidateTag(agentTag(parsed.data.agentId), 'max')
  return { ok: true }
}

export async function deleteDiscordBindingAction(input: {
  agentId: string
  bindingId: string
}): Promise<ActionResult> {
  const userId = await requireUserId()
  const agent = await getAgentByIdForUser(input.agentId, userId)
  if (!agent) {
    return { ok: false, error: 'Agent not found.' }
  }

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
    channel: 'discord',
    externalKey: row.externalKey,
    externalScopeId: row.externalScopeId,
    kind: row.kind,
    userId,
  })

  revalidateTag(agentTag(input.agentId), 'max')
  return { ok: true }
}

export async function disconnectDiscordGuildAction(input: {
  guildId: string
}): Promise<ActionResult> {
  const userId = await requireUserId()
  if (!input.guildId) {
    return { ok: false, error: 'guildId is required.' }
  }

  await deleteDiscordGuildInstallation({ guildId: input.guildId, userId })
  revalidatePath('/channels')
  return { ok: true }
}
