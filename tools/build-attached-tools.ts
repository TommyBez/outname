import type { Tool } from 'ai'
import type {
  PlannedSubAgent,
  PlannedTool,
  ResolveToolPlanResult,
} from '@/workflows/agent-session/steps/resolve-tool-plan'
import { buildAgentTool } from './agent-tool'
import { getMaintainerTool } from './registry'
import type { Reconnect } from './types'

/**
 * Synchronous, pure-JS half of the maintainer-tool boot sequence.
 *
 * The async / I/O / crypto half lives in
 * `workflows/agent-session/steps/resolve-tool-plan.ts` (a workflow
 * step — see the comment at the top of that file for why). This
 * module is deliberately import-graph clean: no DB, no
 * `connection-crypto`, no `connectors/runtime`. That keeps the
 * workflow function bundle free of `node:crypto`.
 *
 * Inputs come straight from `resolveToolPlan` — `planned` and
 * `subAgents` are already filtered for tools that hit
 * credential / cycle / depth / sandbox-readiness reconnects, so we
 * only have to handle one remaining failure mode: the tool's own
 * `build()` throwing.
 */
export interface BuildAttachedToolsResult {
  /** Reconnects to surface in the system prompt + UI. */
  reconnects: Reconnect[]
  /** AI-SDK tool dictionary, keyed by tool id (e.g. "resend_send"). */
  tools: Record<string, Tool>
}

export interface BuildAttachedToolsArgs {
  agentId: string
  /** Phase 4: parent-call lineage. Empty for top-level user-driven turns. */
  callStack?: string[]
  /** Chat conversation id for this event, if any. */
  conversationId?: string | null
  /** App run id for this event, if this event has one. Chat turns do not. */
  currentRunId?: string | null
  /** Phase 4: parent's nesting depth. 0 for top-level. */
  depth?: number
  plan: ResolveToolPlanResult
  /** Stream namespace for live tool UI updates, when visible. */
  streamNamespace?: string | null
  /** Owner of the agent — used to thread parentUserId into sub-agent tools. */
  userId: string
}

function buildOne(args: {
  agentId: string
  conversationId: string | null
  planned: PlannedTool
  reconnects: Reconnect[]
  runId: string | null
  userId: string
}): { id: string; tool: Tool } | null {
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
    return {
      id: p.toolId,
      tool: tool.build({
        agentId,
        userId,
        toolId: p.toolId,
        config: p.config,
        runId,
        conversationId,
      }),
    }
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

  // Start from the reconnects the plan step already produced; this
  // function only adds `build_failed` entries.
  const reconnects: Reconnect[] = [...plan.reconnects]
  const tools: Record<string, Tool> = {}

  for (const planned of plan.planned) {
    const built = buildOne({
      agentId,
      userId,
      planned,
      reconnects,
      runId: currentRunId,
      conversationId,
    })
    if (built) {
      tools[built.id] = built.tool
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
