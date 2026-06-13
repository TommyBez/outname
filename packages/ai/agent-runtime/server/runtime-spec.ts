import 'server-only'
import { composeSystemPrompt } from '@outname/ai/agent-runtime/workflows/session/compose-system-prompt'
import {
  resolveStepLimit,
  type StepLimitMode,
} from '@outname/ai/agent-runtime/workflows/session/step-limit'
import { loadAgentStep } from '@outname/ai/agent-runtime/workflows/session/steps/db/load-agent'
import { resolveSkillPlan } from '@outname/ai/agent-runtime/workflows/session/steps/resolve-skill-plan'
import { resolveToolPlan } from '@outname/ai/agent-runtime/workflows/session/steps/resolve-tool-plan'

export type {
  AgentRuntimeEventKind,
  AgentRuntimeMeta,
  AgentRuntimeSpec,
} from '@outname/ai/agent-runtime/workflows/session/runtime-spec-types'

import type {
  AgentRuntimeEventKind,
  AgentRuntimeSpec,
} from '@outname/ai/agent-runtime/workflows/session/runtime-spec-types'

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
  const row = await loadAgentStep({ agentId: input.agentId })
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
  const skillPlan = await resolveSkillPlan({
    agentId: input.agentId,
  })
  const systemPrompt = await composeSystemPrompt({
    agentId: input.agentId,
    agentName: row.name,
    eventKind: input.eventKind,
    hasSkillTools: skillPlan.skills.length > 0,
    nowIso: input.nowIso ?? new Date().toISOString(),
    reconnects: toolPlan.reconnects,
  })

  return {
    agentId: input.agentId,
    agentName: row.name,
    callStack,
    depth,
    eventKind: input.eventKind,
    inferenceProvider: row.inferenceProvider,
    modelId: row.model,
    stepLimitCustom: row.stepLimitCustom,
    stepLimitMode: row.stepLimitMode as StepLimitMode,
    systemPrompt,
    skillPlan,
    toolPlan,
    userId: row.userId,
  }
}

export function stopWhenFromSpec(spec: AgentRuntimeSpec) {
  return resolveStepLimit({
    custom: spec.stepLimitCustom,
    mode: spec.stepLimitMode,
  })
}
