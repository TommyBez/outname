import 'server-only'
import type { AgentRuntimeSpec } from '@outname/ai/agent-runtime/server/runtime-spec'
import { createFileTools } from '@outname/ai/agent-runtime/workflows/session/tools/file-tools'
import { createSkillTools } from '@outname/ai/agent-runtime/workflows/session/tools/skill-tools'
import { buildAttachedTools } from '@outname/ai/tools/runtime/build-attached-tools'
import type { BuildAgentTool } from '@outname/ai/tools/sub-agents/agent-tool'
import {
  noSubAgentProgressTarget,
  type SubAgentProgressTarget,
} from '@outname/ai/tools/sub-agents/progress-target'
import type { Tool } from 'ai'

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
    ...attached.tools,
    ...createFileTools({ agentId: spec.agentId }),
    ...createSkillTools({
      agentId: spec.agentId,
      skillPlan: spec.skillPlan,
    }),
  }
}
