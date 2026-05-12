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

// AI SDK usage shapes drift (`totalUsage`, root `usage`, per-step `usage`), so
// aggregate defensively instead of assuming a single result shape.
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

// These budget helpers touch services that are unavailable in the workflow
// sandbox, so session handlers must reach them through step shims.
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
  sourceType: 'chat' | 'heartbeat' | 'dreaming' | 'invocation'
  sourceId?: string | null
  model: string
  usage: LanguageModelUsage | undefined
}): Promise<void> {
  'use step'
  try {
    await recordAgentTokenUsage(input)
  } catch (err) {
    // Usage persistence is best-effort because the run already happened.
    console.error('[v0] recordTokenUsageStep: failed to persist usage', err)
  }
}
