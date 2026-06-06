import { checkBudgetExceeded } from '@outname/shared/budgets/server/spend'
import type { BudgetExceededInfo } from '@outname/shared/budgets/server/types'
import { recordAgentTokenUsage } from '@outname/shared/budgets/server/usage'
import { resolveActualModelCost } from '@outname/shared/server/inference-actual-costs'
import type { InferenceProvider } from '@outname/shared/server/inference-providers'
import {
  buildGenerationUsageObservations as buildGenerationUsageObservationsFromResult,
  type GenerationUsageObservation,
  type UsageBearingResult,
} from '@outname/shared/server/model-costs'

export function buildGenerationUsageObservations(
  result: UsageBearingResult | undefined
): GenerationUsageObservation[] {
  return buildGenerationUsageObservationsFromResult(result)
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
  generations: GenerationUsageObservation[]
}): Promise<void> {
  'use step'
  try {
    for (const generation of input.generations) {
      const actualCost = await resolveActualModelCost({
        userId: input.userId,
        inferenceProvider: input.inferenceProvider,
        observation: generation,
      })
      await recordAgentTokenUsage({
        userId: input.userId,
        agentId: input.agentId,
        rootAgentId: input.rootAgentId,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        inferenceProvider: input.inferenceProvider,
        model: input.model,
        actualCost: actualCost.actualCost,
        actualCostUnavailableReason: actualCost.unavailableReason,
        billedModel: generation.modelId,
        generationId: generation.generationId,
        usage: generation.usage,
      })
    }
  } catch (err) {
    // Usage persistence is best-effort because the run already happened.
    console.error('recordTokenUsageStep: failed to persist usage', err)
  }
}
