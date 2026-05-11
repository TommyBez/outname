import type { LanguageModelUsage } from 'ai'
import { checkBudgetExceeded } from '@/budgets/server/spend'
import type { BudgetExceededInfo } from '@/budgets/server/types'
import { recordAgentTokenUsage } from '@/budgets/server/usage'

interface UsageBearingStep {
  usage?: LanguageModelUsage
}

interface UsageBearingResult {
  steps?: readonly UsageBearingStep[]
  totalUsage?: LanguageModelUsage
  usage?: LanguageModelUsage
}

/**
 * Pull an aggregate `LanguageModelUsage` out of a DurableAgent stream
 * result. AI SDK v6 exposes `totalUsage`; older shapes surface a
 * per-step `usage`. Falls back to summing `result.steps[*].usage` so
 * we record something even on minor shape drift between SDK versions.
 */
export function extractTotalUsage(
  result: UsageBearingResult | undefined
): LanguageModelUsage | undefined {
  if (!result) {
    return
  }
  const direct = result.totalUsage ?? result.usage
  if (direct) {
    return direct
  }
  const steps = result.steps ?? []
  if (steps.length === 0) {
    return
  }
  let inputTokens = 0
  let outputTokens = 0
  let totalTokens = 0
  let reasoningTokens = 0
  let cachedInputTokens = 0
  let sawAny = false
  for (const step of steps) {
    const u = step.usage
    if (!u) {
      continue
    }
    sawAny = true
    inputTokens += u.inputTokens ?? 0
    outputTokens += u.outputTokens ?? 0
    totalTokens += u.totalTokens ?? 0
    reasoningTokens += u.reasoningTokens ?? 0
    cachedInputTokens += u.cachedInputTokens ?? 0
  }
  if (!sawAny) {
    return
  }
  return {
    inputTokens,
    outputTokens,
    totalTokens: totalTokens || inputTokens + outputTokens,
    reasoningTokens,
    cachedInputTokens,
  } as LanguageModelUsage
}

/**
 * Workflow-step wrappers around `lib/budget`. The lib functions touch
 * Neon and the AI Gateway pricing fetch, neither of which is available
 * inside the workflow sandbox, so handlers must call them via these
 * `"use step"` shims. Server-side UI paths (CRUD, dashboards) call the
 * lib directly.
 */
export async function preflightBudget(input: {
  userId: string
  rootAgentId: string
}): Promise<BudgetExceededInfo | null> {
  'use step'
  return await checkBudgetExceeded(input)
}

export async function recordTokenUsageStep(input: {
  userId: string
  agentId: string
  rootAgentId: string
  sourceType: 'chat' | 'heartbeat' | 'reflection' | 'invocation'
  sourceId?: string | null
  model: string
  usage: LanguageModelUsage | undefined
}): Promise<void> {
  'use step'
  try {
    await recordAgentTokenUsage(input)
  } catch (err) {
    // Persistence failure must not poison the outer event — the run
    // already happened. Surface the error in logs and let the loop
    // continue.
    console.error('[v0] recordTokenUsageStep: failed to persist usage', err)
  }
}
