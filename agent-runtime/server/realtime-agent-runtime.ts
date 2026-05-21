import 'server-only'
import {
  type Tool,
  ToolLoopAgent,
  type ToolLoopAgentOnFinishCallback,
} from 'ai'
import {
  type AgentRuntimeMeta,
  type AgentRuntimeSpec,
  runtimeMetaFromSpec,
  stopWhenFromSpec,
} from '@/agent-runtime/server/runtime-spec'
import { createFileTools } from '@/agent-runtime/workflows/session/tools/file-tools'
import { getUserModelForGateway } from '@/shared/server/ai-gateway-byok'
import { buildAttachedTools } from '@/tools/runtime/build-attached-tools'
import {
  noSubAgentProgressTarget,
  type SubAgentProgressTarget,
} from '@/tools/sub-agents/progress-target'

export interface BuiltRealtimeAgentRuntime {
  agent: ToolLoopAgent<never, Record<string, Tool>>
  meta: AgentRuntimeMeta
  tools: Record<string, Tool>
}

export async function buildRealtimeAgentRuntime(
  spec: AgentRuntimeSpec,
  options: {
    conversationId?: string | null
    currentRunId?: string | null
    onFinish?: ToolLoopAgentOnFinishCallback<Record<string, Tool>>
    progressTarget?: SubAgentProgressTarget
  } = {}
): Promise<BuiltRealtimeAgentRuntime> {
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
  const tools = {
    ...createFileTools({ agentId: spec.agentId }),
    ...attached.tools,
  }
  const model = await getUserModelForGateway({
    modelId: spec.modelId,
    userId: spec.userId,
  })

  return {
    agent: new ToolLoopAgent({
      id: spec.agentId,
      instructions: spec.systemPrompt,
      model,
      tools,
      stopWhen: stopWhenFromSpec(spec),
      onFinish: options.onFinish,
    }),
    meta: runtimeMetaFromSpec(spec),
    tools,
  }
}
