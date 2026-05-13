'use server'

import { and, eq } from 'drizzle-orm'
import { revalidatePath, updateTag } from 'next/cache'
import { redirect } from 'next/navigation'
import { destroyAgentSandboxes } from '@/agent-runtime/server/agent-sandbox'
import {
  startAgentSession,
  stopAgentSession,
} from '@/agent-runtime/server/session-lifecycle'
import { createAgentForUser } from '@/agents/server/creation-service'
import {
  type UpdateAgentInput,
  updateAgentForUser,
} from '@/agents/server/update-service'
import { requireSession } from '@/auth/server/auth-guard'
import { db } from '@/shared/db'
import { agent } from '@/shared/db/schema'
import {
  agentTag,
  conversationListTag,
  userAgentsTag,
} from '@/shared/server/cache-tags'

interface CreateInput {
  dreamingEnabled: boolean
  dreamingIntervalMinutes: number
  heartbeatEnabled: boolean
  heartbeatIntervalMinutes: number
  identityCard: string
  instructions: string
  model: string
  name: string
  soul: string
  stepLimitCustom?: number | null
  stepLimitMode: 'custom' | 'grind' | 'high' | 'low' | 'medium'
  userProfile: string
}

export async function createAgentAction(
  input: CreateInput
): Promise<{ id: string }> {
  const session = await requireSession()
  const result = await createAgentForUser({
    ...input,
    userId: session.user.id,
  })

  updateTag(userAgentsTag(session.user.id))
  updateTag(agentTag(result.id))
  revalidatePath('/agents')
  revalidatePath('/')
  return { id: result.id }
}

export async function updateAgentAction(
  input: UpdateAgentInput
): Promise<void> {
  const session = await requireSession()
  await updateAgentForUser({ ...input, userId: session.user.id })

  updateTag(userAgentsTag(session.user.id))
  updateTag(agentTag(input.id))
  revalidatePath('/agents')
  revalidatePath(`/agents/${input.id}`)
  revalidatePath(`/agents/${input.id}/configure`)
  revalidatePath(`/agents/${input.id}/edit`)
  revalidatePath('/')
}

export async function toggleAgentAction(
  agentId: string,
  enabled: boolean
): Promise<void> {
  const session = await requireSession()
  const [existing] = await db
    .select()
    .from(agent)
    .where(and(eq(agent.id, agentId), eq(agent.userId, session.user.id)))
    .limit(1)
  if (!existing) {
    return
  }

  const [updated] = await db
    .update(agent)
    .set({ enabled, updatedAt: new Date() })
    .where(eq(agent.id, agentId))
    .returning()

  if (!existing.enabled && updated.enabled) {
    try {
      await startAgentSession(updated)
    } catch (err) {
      console.error('[v0] toggleAgentAction: startAgentSession failed', err)
    }
  } else if (existing.enabled && !updated.enabled) {
    await stopAgentSession(agentId)
  }

  updateTag(userAgentsTag(session.user.id))
  updateTag(agentTag(agentId))
  revalidatePath('/agents')
  revalidatePath(`/agents/${agentId}`)
  revalidatePath(`/agents/${agentId}/configure`)
  revalidatePath('/')
}

export async function deleteAgentAction(agentId: string): Promise<void> {
  const session = await requireSession()
  const [existing] = await db
    .select()
    .from(agent)
    .where(and(eq(agent.id, agentId), eq(agent.userId, session.user.id)))
    .limit(1)
  if (!existing) {
    redirect('/agents')
  }

  // Stop the session first so it cannot write into a torn-down sandbox or row.
  await stopAgentSession(agentId)

  // Best-effort delete of the persistent sandbox before removing the agent row.
  await destroyAgentSandboxes(agentId)

  await db
    .delete(agent)
    .where(and(eq(agent.id, agentId), eq(agent.userId, session.user.id)))

  updateTag(userAgentsTag(session.user.id))
  updateTag(agentTag(agentId))
  updateTag(conversationListTag(agentId))
  revalidatePath('/agents')
  revalidatePath('/')
  redirect('/agents')
}
