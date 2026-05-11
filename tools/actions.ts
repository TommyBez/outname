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

export async function attachSubAgentAction(
  parentAgentId: string,
  childAgentId: string
): Promise<AttachResult> {
  // Longer cycle checks happen at run time in `resolveToolPlan`; attach only
  // needs to reject invalid ownership and direct self-reference.
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
