'use server'

import {
  type AttachResult,
  attachMaintainerToolForUser,
  attachSubAgentForUser,
  detachToolForUser,
} from '@/lib/agent-tool-attachment-service'
import { requireUserId } from '@/lib/auth-guard'
import type { AgentToolKind } from '@/lib/db/schema'

export async function attachToolAction(
  agentId: string,
  toolId: string,
  rawConfig: Record<string, unknown>
): Promise<AttachResult> {
  const userId = await requireUserId()
  return attachMaintainerToolForUser({ agentId, toolId, rawConfig, userId })
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
  return attachSubAgentForUser({ parentAgentId, childAgentId, userId })
}

export async function detachToolAction(
  agentId: string,
  toolId: string,
  kind: AgentToolKind = 'maintainer'
): Promise<AttachResult> {
  const userId = await requireUserId()
  return detachToolForUser({ agentId, toolId, kind, userId })
}
