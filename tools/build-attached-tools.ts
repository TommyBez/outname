import type { Tool } from 'ai'
import type { RawCredential } from '@/connectors/types'
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
 * Inputs come straight from `resolveToolPlan` — `planned`, `creds`,
 * and `subAgents` are already filtered for tools that hit
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
  /** Owner of the agent — used to thread parentUserId into sub-agent tools. */
  userId: string
  plan: ResolveToolPlanResult
  /** Phase 4: parent-call lineage. Empty for top-level user-driven turns. */
  callStack?: string[]
  /** Phase 4: parent's nesting depth. 0 for top-level. */
  depth?: number
}

function buildOne(args: {
  agentId: string
  creds: Record<string, RawCredential>
  planned: PlannedTool
  reconnects: Reconnect[]
}): { id: string; tool: Tool } | null {
  const { agentId, creds, planned: p, reconnects } = args
  const tool = getMaintainerTool(p.toolId)
  if (!tool) {
    return null
  }
  // Build the credentials slice the tool actually needs. The plan
  // step already guaranteed every required provider is present in
  // `creds`.
  const credentials: Record<string, RawCredential> = {}
  for (const req of p.requirements) {
    const raw = creds[req.provider]
    if (raw !== undefined) {
      credentials[req.provider] = raw
    }
  }
  try {
    return {
      id: p.toolId,
      tool: tool.build({
        agentId,
        toolId: p.toolId,
        config: p.config,
        credentials,
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
  parentUserId: string
  callStack: string[]
  depth: number
  sub: PlannedSubAgent
  reconnects: Reconnect[]
}): { id: string; tool: Tool } | null {
  const { parentUserId, callStack, depth, sub, reconnects } = args
  try {
    return {
      id: sub.toolId,
      tool: buildAgentTool({
        childAgentId: sub.childAgentId,
        childName: sub.childName,
        childDescription: sub.childDescription,
        childUserId: sub.childUserId,
        parentUserId,
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
  const depth = args.depth ?? 0

  // Start from the reconnects the plan step already produced; this
  // function only adds `build_failed` entries.
  const reconnects: Reconnect[] = [...plan.reconnects]
  const tools: Record<string, Tool> = {}

  for (const planned of plan.planned) {
    const built = buildOne({ agentId, creds: plan.creds, planned, reconnects })
    if (built) {
      tools[built.id] = built.tool
    }
  }

  for (const sub of plan.subAgents) {
    const built = buildSubAgentEntry({
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
