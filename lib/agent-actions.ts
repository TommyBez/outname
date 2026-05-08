'use server'

import { and, eq } from 'drizzle-orm'
import { revalidatePath, updateTag } from 'next/cache'
import { redirect } from 'next/navigation'
import { createAgentForUser } from '@/lib/agent-creation-service'
import { destroyAgentSandboxes } from '@/lib/agent-sandbox'
import { startAgentSession, stopAgentSession } from '@/lib/agent-session'
import {
  type UpdateAgentInput,
  updateAgentForUser,
} from '@/lib/agent-update-service'
import { requireSession } from '@/lib/auth-guard'
import { agentTag, conversationListTag, userAgentsTag } from '@/lib/cache-tags'
import { db } from '@/lib/db'
import { agent } from '@/lib/db/schema'

interface CreateInput {
  heartbeatEnabled: boolean
  heartbeatIntervalMinutes: number
  /**
   * IDENTITY.md content authored via the "Identity card" tab. Empty string
   * means "keep the default empty identity card" — the seed step still
   * creates the file so every agent has a stable injection point.
   */
  identityCard: string
  /**
   * AGENTS.md content authored via the "Instructions" tab. Empty
   * string means "use the default seed template" — the
   * `seedAgentsMd` step writes the platform default on first
   * sandbox boot.
   */
  instructions: string
  model: string
  name: string
  reflectionEnabled: boolean
  reflectionIntervalMinutes: number
  /**
   * SOUL.md content authored via the "Soul" tab. Empty string means
   * "don't seed a deeper persona layer yet" — the file is left absent
   * until the user fills it in later.
   */
  soul: string
  stepLimitCustom?: number | null
  stepLimitMode: 'custom' | 'grind' | 'high' | 'low' | 'medium'
  /**
   * USER.md seed/correction content from the "User profile" tab. Empty
   * string means "let the agent create it when it learns stable facts."
   */
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

  // Stop the session first so it doesn't try to write into a torn-down
  // sandbox or a deleted agent row mid-event.
  await stopAgentSession(agentId)

  // Best-effort: tear down the agent's persistent system sandbox
  // before removing the row so we don't leak it. Any failure is
  // swallowed inside the helper.
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
