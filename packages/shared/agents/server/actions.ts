'use server'

import { destroyAgentSandboxes } from '@outname/ai/agent-runtime/server/agent-sandbox'
import { requireSession } from '@outname/auth/server/auth-guard'
import { db } from '@outname/db'
import { agent, agentEvents } from '@outname/db/schema'
import type { AgentScheduleMode } from '@outname/shared/agent-schedule'
import { createAgentForUser } from '@outname/shared/agents/server/creation-service'
import {
  type UpdateAgentInput,
  updateAgentForUser,
} from '@outname/shared/agents/server/update-service'
import {
  agentTag,
  conversationListTag,
  userAgentsTag,
} from '@outname/shared/server/cache-tags'
import { and, eq } from 'drizzle-orm'
import { revalidatePath, updateTag } from 'next/cache'
import { redirect } from 'next/navigation'

interface CreateInput {
  dreamingEnabled: boolean
  heartbeatEnabled: boolean
  heartbeatIntervalMinutes: number
  heartbeatScheduleMode?: AgentScheduleMode
  heartbeatScheduleTimes?: string[]
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

  await Promise.all([
    db
      .update(agentEvents)
      .set({
        completedAt: new Date(),
        lastError: 'agent deleted',
        status: 'cancelled',
        updatedAt: new Date(),
      })
      .where(eq(agentEvents.agentId, agentId)),
    // Best-effort delete of the persistent sandbox before removing the agent row.
    destroyAgentSandboxes(agentId),
  ])

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
