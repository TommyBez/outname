import 'server-only'
import { getAgentById } from '@/agent-runtime/server/start-agent-run'
import { composeSystemPrompt } from '@/agent-runtime/workflows/session/compose-system-prompt'
import {
  resolveStepLimit,
  type StepLimitMode,
} from '@/agent-runtime/workflows/session/step-limit'
import {
  type ResolveToolPlanResult,
  resolveToolPlan,
} from '@/agent-runtime/workflows/session/steps/resolve-tool-plan'

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

export interface BuildAgentRuntimeSpecInput {
  agentId: string
  callStack?: string[]
  depth?: number
  eventKind: AgentRuntimeEventKind
  nowIso?: string
  runId?: string
}

export async function buildAgentRuntimeSpec(
  input: BuildAgentRuntimeSpecInput
): Promise<AgentRuntimeSpec> {
  const callStack = input.callStack ?? []
  const depth = input.depth ?? 0
  const row = await getAgentById(input.agentId)
  if (!row) {
    const suffix = input.runId ? ` (run ${input.runId})` : ''
    throw new Error(
      `buildAgentRuntimeSpec: agent ${input.agentId} not found${suffix}`
    )
  }

  const toolPlan = await resolveToolPlan({
    agentId: input.agentId,
    userId: row.userId,
    callStack,
    depth,
  })
  const systemPrompt = await composeSystemPrompt({
    agentId: input.agentId,
    agentName: row.name,
    eventKind: input.eventKind,
    nowIso: input.nowIso ?? new Date().toISOString(),
    reconnects: toolPlan.reconnects,
  })

  return {
    agentId: input.agentId,
    agentName: row.name,
    callStack,
    depth,
    eventKind: input.eventKind,
    modelId: row.model,
    stepLimitCustom: row.stepLimitCustom,
    stepLimitMode: row.stepLimitMode as StepLimitMode,
    systemPrompt,
    toolPlan,
    userId: row.userId,
  }
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

export function stopWhenFromSpec(spec: AgentRuntimeSpec) {
  return resolveStepLimit({
    custom: spec.stepLimitCustom,
    mode: spec.stepLimitMode,
  })
}
