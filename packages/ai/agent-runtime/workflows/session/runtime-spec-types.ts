import type { InferenceProvider } from '@outname/shared/server/inference-providers'
import type { StepLimitMode } from './step-limit'
import type { ResolveToolPlanResult } from './steps/resolve-tool-plan/types'

export type AgentRuntimeEventKind =
  | 'chat'
  | 'dreaming'
  | 'heartbeat'
  | 'invocation'

export interface AgentRuntimeSpec {
  agentId: string
  agentName: string
  callStack: string[]
  depth: number
  eventKind: AgentRuntimeEventKind
  inferenceProvider: InferenceProvider
  modelId: string
  stepLimitCustom: number | null
  stepLimitMode: StepLimitMode
  systemPrompt: string
  toolPlan: ResolveToolPlanResult
  userId: string
}

export interface AgentRuntimeMeta {
  inferenceProvider: InferenceProvider
  model: string
  name: string
  stepLimitCustom: number | null
  stepLimitMode: StepLimitMode
  userId: string
}

export function runtimeMetaFromSpec(spec: AgentRuntimeSpec): AgentRuntimeMeta {
  return {
    inferenceProvider: spec.inferenceProvider,
    model: spec.modelId,
    name: spec.agentName,
    stepLimitCustom: spec.stepLimitCustom,
    stepLimitMode: spec.stepLimitMode,
    userId: spec.userId,
  }
}
