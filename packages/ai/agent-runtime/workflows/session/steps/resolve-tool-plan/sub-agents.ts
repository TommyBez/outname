import type { Reconnect } from '@outname/ai/tools/catalog/types'
import {
  isLegacySubAgentToolId,
  uniqueSubAgentToolId,
} from '@outname/ai/tools/sub-agents/sub-agent-tool-name'
import { db } from '@outname/db'
import { agent } from '@outname/db/schema'
import { inArray } from 'drizzle-orm'
import type { PlannedSubAgent, SubAgentResolution, SubAgentRow } from './types'
import { MAX_SUB_AGENT_DEPTH } from './types'

interface SubAgentChild {
  capabilitySummary: string | null
  enabled: boolean
  id: string
  name: string
  userId: string
}

export async function resolveSubAgentRows(input: {
  agentId: string
  userId: string
  callStack: string[]
  depth: number
  subAgentRows: SubAgentRow[]
  usedToolIds: Set<string>
}): Promise<SubAgentResolution> {
  const { agentId, userId, callStack, depth, subAgentRows, usedToolIds } = input
  const reconnects: Reconnect[] = []
  const subAgents: PlannedSubAgent[] = []
  const childRows = await loadSubAgentChildren(subAgentRows)
  const byId = new Map(childRows.map((row) => [row.id, row]))

  for (const sub of subAgentRows) {
    const child = byId.get(sub.childAgentId)
    const validated = validateSubAgentChild({
      sub,
      child,
      userId,
      agentId,
      callStack,
      depth,
    })
    if (validated.kind === 'reconnect') {
      reconnects.push(validated.reconnect)
    } else {
      const toolId = runtimeSubAgentToolId({
        childAgentId: validated.planned.childAgentId,
        childName: validated.planned.childName,
        rowToolId: validated.planned.rowToolId,
        usedToolIds,
      })
      usedToolIds.add(toolId)
      subAgents.push({ ...validated.planned, toolId })
    }
  }

  return { reconnects, subAgents }
}

async function loadSubAgentChildren(
  subAgentRows: SubAgentRow[]
): Promise<SubAgentChild[]> {
  const childIds = Array.from(
    new Set(subAgentRows.map((subAgent) => subAgent.childAgentId))
  )
  return await db
    .select({
      id: agent.id,
      capabilitySummary: agent.capabilitySummary,
      name: agent.name,
      userId: agent.userId,
      enabled: agent.enabled,
    })
    .from(agent)
    .where(inArray(agent.id, childIds))
}

function runtimeSubAgentToolId(input: {
  childAgentId: string
  childName: string
  rowToolId: string
  usedToolIds: Set<string>
}): string {
  const shouldRenameStoredToolId =
    isLegacySubAgentToolId({
      childAgentId: input.childAgentId,
      toolId: input.rowToolId,
    }) || input.usedToolIds.has(input.rowToolId)
  if (!shouldRenameStoredToolId) {
    return input.rowToolId
  }
  return uniqueSubAgentToolId({
    childAgentId: input.childAgentId,
    childName: input.childName,
    usedToolIds: input.usedToolIds,
  })
}

function validateSubAgentChild(input: {
  sub: SubAgentRow
  child: SubAgentChild | undefined
  userId: string
  agentId: string
  callStack: string[]
  depth: number
}):
  | { kind: 'reconnect'; reconnect: Reconnect }
  | { kind: 'planned'; planned: PlannedSubAgent } {
  const { sub, child, userId, agentId, callStack, depth } = input

  if (!child) {
    return reconnect(sub.rowToolId, 'Sub-agent has been deleted')
  }
  if (child.userId !== userId) {
    return reconnect(
      sub.rowToolId,
      'Sub-agent is not owned by the current user'
    )
  }
  if (!child.enabled) {
    return reconnect(sub.rowToolId, 'Sub-agent is disabled')
  }
  if (callStack.includes(child.id) || child.id === agentId) {
    return {
      kind: 'reconnect',
      reconnect: { toolId: sub.rowToolId, reason: 'sub_agent_cycle' },
    }
  }
  if (depth + 1 > MAX_SUB_AGENT_DEPTH) {
    return {
      kind: 'reconnect',
      reconnect: { toolId: sub.rowToolId, reason: 'sub_agent_depth' },
    }
  }
  return {
    kind: 'planned',
    planned: {
      childAgentId: child.id,
      childCapabilitySummary: child.capabilitySummary,
      childName: child.name,
      childUserId: child.userId,
      rowToolId: sub.rowToolId,
      toolId: sub.rowToolId,
    },
  }
}

function reconnect(
  toolId: string,
  message: string
): { kind: 'reconnect'; reconnect: Reconnect } {
  return {
    kind: 'reconnect',
    reconnect: { toolId, reason: 'sub_agent_unavailable', message },
  }
}
