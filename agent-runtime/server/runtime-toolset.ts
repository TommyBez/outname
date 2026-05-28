import 'server-only'
import type { Tool } from 'ai'
import type { AgentRuntimeSpec } from '@/agent-runtime/server/runtime-spec'
import { createFileTools } from '@/agent-runtime/workflows/session/tools/file-tools'
import { buildAttachedTools } from '@/tools/runtime/build-attached-tools'
import type { BuildAgentTool } from '@/tools/sub-agents/agent-tool'
import {
  noSubAgentProgressTarget,
  type SubAgentProgressTarget,
} from '@/tools/sub-agents/progress-target'

export function buildRuntimeToolset(
  spec: AgentRuntimeSpec,
  options: {
    buildSubAgentTool: BuildAgentTool
    conversationId?: string | null
    currentRunId?: string | null
    progressTarget?: SubAgentProgressTarget
  }
): Record<string, Tool> {
  const attached = buildAttachedTools({
    agentId: spec.agentId,
    userId: spec.userId,
    plan: spec.toolPlan,
    callStack: spec.callStack,
    currentRunId: options.currentRunId,
    conversationId: options.conversationId,
    buildSubAgentTool: options.buildSubAgentTool,
    depth: spec.depth,
    progressTarget: options.progressTarget ?? noSubAgentProgressTarget,
  })

  return {
    ...createFileTools({ agentId: spec.agentId }),
    ...attached.tools,
  }
}
