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
  modelId: string
  stepLimitCustom: number | null
  stepLimitMode: StepLimitMode
  systemPrompt: string
  toolPlan: ResolveToolPlanResult
  userId: string
}

export interface AgentRuntimeMeta {
  model: string
  name: string
  stepLimitCustom: number | null
  stepLimitMode: StepLimitMode
  userId: string
}

export function runtimeMetaFromSpec(spec: AgentRuntimeSpec): AgentRuntimeMeta {
  return {
    model: spec.modelId,
    name: spec.agentName,
    stepLimitCustom: spec.stepLimitCustom,
    stepLimitMode: spec.stepLimitMode,
    userId: spec.userId,
  }
}
