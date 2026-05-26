import 'server-only'
import {
  type Tool,
  ToolLoopAgent,
  type ToolLoopAgentOnFinishCallback,
} from 'ai'
import { stopWhenFromSpec } from '@/agent-runtime/server/runtime-spec'
import {
  type AgentRuntimeMeta,
  type AgentRuntimeSpec,
  runtimeMetaFromSpec,
} from '@/agent-runtime/workflows/session/runtime-spec-types'
import { getUserModelForGateway } from '@/shared/server/ai-gateway-byok'
import type { SubAgentProgressTarget } from '@/tools/sub-agents/progress-target'
import { buildRuntimeToolset } from './runtime-toolset'

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
  const tools = buildRuntimeToolset(spec, options)
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
