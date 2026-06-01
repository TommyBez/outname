'use server'

import { detachToolForUser } from '@outname/ai/tools/server/attachment-service/detach'
import { attachMaintainerToolForUser } from '@outname/ai/tools/server/attachment-service/maintainer'
import { attachSubAgentForUser } from '@outname/ai/tools/server/attachment-service/sub-agent'
import type { AttachResult } from '@outname/ai/tools/server/attachment-service/types'
import { requireUserId } from '@outname/auth/server/auth-guard'
import type { AgentToolKind } from '@outname/db/schema'
import {
  agentTag,
  agentToolsTag,
  userAgentsTag,
} from '@outname/shared/server/cache-tags'
import { revalidatePath, updateTag } from 'next/cache'

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
