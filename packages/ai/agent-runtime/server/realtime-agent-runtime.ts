import 'server-only'
import { stopWhenFromSpec } from '@outname/ai/agent-runtime/server/runtime-spec'
import {
  type AgentRuntimeMeta,
  type AgentRuntimeSpec,
  runtimeMetaFromSpec,
} from '@outname/ai/agent-runtime/workflows/session/runtime-spec-types'
import type { SubAgentProgressTarget } from '@outname/ai/tools/sub-agents/progress-target'
import { buildRealtimeAgentTool } from '@outname/ai/tools/sub-agents/realtime-agent-tool'
import { getUserModelForGateway } from '@outname/shared/server/ai-gateway-byok'
import {
  type Tool,
  ToolLoopAgent,
  type ToolLoopAgentOnFinishCallback,
} from 'ai'
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
  const tools = buildRuntimeToolset(spec, {
    ...options,
    buildSubAgentTool: buildRealtimeAgentTool,
  })
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
