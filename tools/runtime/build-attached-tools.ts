import type { Tool } from 'ai'
import type {
  PlannedSubAgent,
  PlannedTool,
  ResolveToolPlanResult,
} from '@/agent-runtime/workflows/session/steps/resolve-tool-plan'
import { getMaintainerTool } from '@/tools/catalog/registry'
import type { BuiltMaintainerTool, Reconnect } from '@/tools/catalog/types'
import { buildAgentTool } from '@/tools/sub-agents/agent-tool'

// Keep this module pure JS: I/O, DB, and crypto stay in `resolveToolPlan` so
// the workflow bundle does not pull in `node:crypto`.
export interface BuildAttachedToolsResult {
  reconnects: Reconnect[]
  tools: Record<string, Tool>
}

export interface BuildAttachedToolsArgs {
  agentId: string
  callStack?: string[]
  conversationId?: string | null
  currentRunId?: string | null
  depth?: number
  plan: ResolveToolPlanResult
  streamNamespace?: string | null
  userId: string
}

function buildOne(args: {
  agentId: string
  conversationId: string | null
  planned: PlannedTool
  reconnects: Reconnect[]
  runId: string | null
  userId: string
}): Array<{ id: string; tool: Tool }> | null {
  const {
    agentId,
    conversationId,
    runId,
    userId,
    planned: p,
    reconnects,
  } = args
  const tool = getMaintainerTool(p.toolId)
  if (!tool) {
    return null
  }
  try {
    const built = tool.build({
      agentId,
      userId,
      toolId: p.toolId,
      config: p.config,
      runId,
      conversationId,
    })
    return toBuiltToolEntries(p.toolId, built)
  } catch (err) {
    console.error('[v0] buildAttachedTools: build failed', {
      agentId,
      toolId: p.toolId,
      err,
    })
    reconnects.push({
      toolId: p.toolId,
      reason: 'build_failed',
      message: err instanceof Error ? err.message : String(err),
    })
    return null
  }
}

function buildSubAgentEntry(args: {
  parentAgentId: string
  parentRunId: string | null
  streamNamespace: string | null
  parentToolId: string
  parentUserId: string
  callStack: string[]
  depth: number
  sub: PlannedSubAgent
  reconnects: Reconnect[]
}): { id: string; tool: Tool } | null {
  const {
    parentAgentId,
    parentRunId,
    streamNamespace,
    parentToolId,
    parentUserId,
    callStack,
    depth,
    sub,
    reconnects,
  } = args
  try {
    return {
      id: sub.toolId,
      tool: buildAgentTool({
        childAgentId: sub.childAgentId,
        childCapabilitySummary: sub.childCapabilitySummary,
        childName: sub.childName,
        childUserId: sub.childUserId,
        parentAgentId,
        parentUserId,
        parentRunId,
        streamNamespace,
        parentToolId,
        parentCallStack: callStack,
        parentDepth: depth,
      }),
    }
  } catch (err) {
    reconnects.push({
      toolId: sub.toolId,
      reason: 'build_failed',
      message: err instanceof Error ? err.message : String(err),
    })
    return null
  }
}

export function buildAttachedTools(
  args: BuildAttachedToolsArgs
): BuildAttachedToolsResult {
  const { agentId, userId, plan } = args
  const callStack = args.callStack ?? []
  const currentRunId = args.currentRunId ?? null
  const conversationId = args.conversationId ?? null
  const depth = args.depth ?? 0
  const streamNamespace = args.streamNamespace ?? null

  // Reuse reconnects from planning; this layer only adds `build_failed`.
  const reconnects: Reconnect[] = [...plan.reconnects]
  const tools: Record<string, Tool> = {}

  for (const planned of plan.planned) {
    const builtEntries = buildOne({
      agentId,
      userId,
      planned,
      reconnects,
      runId: currentRunId,
      conversationId,
    })
    if (builtEntries) {
      for (const built of builtEntries) {
        if (tools[built.id]) {
          reconnects.push({
            toolId: planned.toolId,
            reason: 'build_failed',
            message: `Tool exposed duplicate runtime id: ${built.id}`,
          })
          continue
        }
        tools[built.id] = built.tool
      }
    }
  }

  for (const sub of plan.subAgents) {
    const built = buildSubAgentEntry({
      parentAgentId: agentId,
      parentRunId: currentRunId,
      streamNamespace,
      parentToolId: sub.toolId,
      parentUserId: userId,
      callStack,
      depth,
      sub,
      reconnects,
    })
    if (built) {
      tools[built.id] = built.tool
    }
  }

  return { tools, reconnects }
}

function toBuiltToolEntries(
  defaultToolId: string,
  built: BuiltMaintainerTool
): Array<{ id: string; tool: Tool }> {
  if (isBuiltToolMap(built)) {
    return Object.entries(built).map(([id, tool]) => ({ id, tool }))
  }
  return [{ id: defaultToolId, tool: built }]
}

function isBuiltToolMap(
  built: BuiltMaintainerTool
): built is Record<string, Tool> {
  return (
    typeof built === 'object' &&
    built !== null &&
    !('execute' in built) &&
    !('inputSchema' in built)
  )
}
