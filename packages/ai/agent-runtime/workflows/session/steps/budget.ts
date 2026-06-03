import { checkBudgetExceeded } from '@outname/shared/budgets/server/spend'
import type { BudgetExceededInfo } from '@outname/shared/budgets/server/types'
import { recordAgentTokenUsage } from '@outname/shared/budgets/server/usage'
import type { InferenceProvider } from '@outname/shared/server/inference-providers'
import {
  extractTotalUsage as extractTotalUsageFromResult,
  type UsageBearingResult,
} from '@outname/shared/server/model-costs'
import type { LanguageModelUsage } from 'ai'

export function extractTotalUsage(
  result: UsageBearingResult | undefined
): LanguageModelUsage | undefined {
  return extractTotalUsageFromResult(result)
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
  inferenceProvider: InferenceProvider
  model: string
  usage: LanguageModelUsage | undefined
}): Promise<void> {
  'use step'
  try {
    await recordAgentTokenUsage(input)
  } catch (err) {
    // Usage persistence is best-effort because the run already happened.
    console.error('recordTokenUsageStep: failed to persist usage', err)
  }
}
