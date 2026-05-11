'use server'

import { revalidatePath, updateTag } from 'next/cache'
import { requireUserId } from '@/auth/server/auth-guard'
import type { AgentToolKind } from '@/shared/db/schema'
import {
  agentTag,
  agentToolsTag,
  userAgentsTag,
} from '@/shared/server/cache-tags'
import { detachToolForUser } from '@/tools/server/attachment-service/detach'
import { attachMaintainerToolForUser } from '@/tools/server/attachment-service/maintainer'
import { attachSubAgentForUser } from '@/tools/server/attachment-service/sub-agent'
import type { AttachResult } from '@/tools/server/attachment-service/types'

export async function attachToolAction(
  agentId: string,
  toolId: string,
  rawConfig: Record<string, unknown>
): Promise<AttachResult> {
  const userId = await requireUserId()
  const result = await attachMaintainerToolForUser({
    agentId,
    toolId,
    rawConfig,
    userId,
  })
  if (result.ok) {
    updateAgentToolSurfaces(agentId, userId)
  }
  return result
}

/**
 * Phase 4: attach one of the user's other agents as a sub-agent.
 *
 * The model sees this as an `agent_<childId>` tool. We:
 *
 *   - Refuse to attach an agent to itself (cycle of length 0).
 *   - Refuse if the parent and child are owned by different users.
 *   - Don't validate cycles deeper than self-attach here; longer
 *     cycles are caught at run time by `resolveToolPlan` and never
 *     reach the LLM.
 *
 * No tool-sandbox build needed — sub-agents are pure DB rows.
 */
export async function attachSubAgentAction(
  parentAgentId: string,
  childAgentId: string
): Promise<AttachResult> {
  const userId = await requireUserId()
  const result = await attachSubAgentForUser({
    parentAgentId,
    childAgentId,
    userId,
  })
  if (result.ok) {
    updateAgentToolSurfaces(parentAgentId, userId)
  }
  return result
}

export async function detachToolAction(
  agentId: string,
  toolId: string,
  kind: AgentToolKind = 'maintainer'
): Promise<AttachResult> {
  const userId = await requireUserId()
  const result = await detachToolForUser({ agentId, toolId, kind, userId })
  if (result.ok) {
    updateAgentToolSurfaces(agentId, userId)
  }
  return result
}

function updateAgentToolSurfaces(agentId: string, userId: string): void {
  updateTag(agentToolsTag(agentId))
  updateTag(agentTag(agentId))
  updateTag(userAgentsTag(userId))
  revalidatePath(`/agents/${agentId}`)
  revalidatePath(`/agents/${agentId}/tools`)
  revalidatePath('/agents')
  revalidatePath('/dashboard')
}
