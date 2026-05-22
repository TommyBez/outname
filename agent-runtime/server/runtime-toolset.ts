import 'server-only'
import type { Tool } from 'ai'
import type { AgentRuntimeSpec } from '@/agent-runtime/server/runtime-spec'
import { createFileTools } from '@/agent-runtime/workflows/session/tools/file-tools'
import { buildAttachedTools } from '@/tools/runtime/build-attached-tools'
import {
  noSubAgentProgressTarget,
  type SubAgentProgressTarget,
} from '@/tools/sub-agents/progress-target'

export function buildRuntimeToolset(
  spec: AgentRuntimeSpec,
  options: {
    conversationId?: string | null
    currentRunId?: string | null
    progressTarget?: SubAgentProgressTarget
  } = {}
): Record<string, Tool> {
  const attached = buildAttachedTools({
    agentId: spec.agentId,
    userId: spec.userId,
    plan: spec.toolPlan,
    callStack: spec.callStack,
    currentRunId: options.currentRunId,
    conversationId: options.conversationId,
    depth: spec.depth,
    progressTarget: options.progressTarget ?? noSubAgentProgressTarget,
  })

  return {
    ...createFileTools({ agentId: spec.agentId }),
    ...attached.tools,
  }
}
