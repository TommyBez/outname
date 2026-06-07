import 'server-only'

import { db } from '@outname/db'
import { agentTokenUsage } from '@outname/db/schema'
import { getModelPricing } from '@outname/shared/server/inference-models'
import type { InferenceProvider } from '@outname/shared/server/inference-providers'
import {
  type ActualModelCost,
  estimateModelCost,
  normalizeUsage,
  type UsageInput,
} from '@outname/shared/server/model-costs'
import type { LanguageModelUsage } from 'ai'

export async function recordAgentTokenUsage(input: {
  userId: string
  agentId: string
  rootAgentId: string
  sourceType: 'chat' | 'heartbeat' | 'dreaming' | 'invocation'
  sourceId?: string | null
  inferenceProvider: InferenceProvider
  model: string
  actualCost?: ActualModelCost | null
  actualCostUnavailableReason?: string | null
  billedModel?: string | null
  generationId?: string | null
  upstreamProvider?: string | null
  usage: LanguageModelUsage | UsageInput | undefined
}): Promise<void> {
  const usage = normalizeUsage(input.usage)
  if (
    usage.inputTokens === 0 &&
    usage.outputTokens === 0 &&
    usage.totalTokens === 0 &&
    usage.reasoningTokens === 0 &&
    usage.cacheReadTokens === 0 &&
    usage.cacheWriteTokens === 0 &&
    !input.actualCost
  ) {
    return
  }

  const billedModel = input.actualCost?.billedModel ?? input.billedModel ?? null
  const pricedModelId = billedModel ?? input.model
  const pricing = await getModelPricing({
    inferenceProvider: input.inferenceProvider,
    modelId: pricedModelId,
  }).catch(() => null)
  const estimate = estimateModelCost({ pricing, usage })
  const costSource = resolveCostSource({
    hasActualCost: Boolean(input.actualCost),
    hasPricing: Boolean(pricing),
  })

  await db.insert(agentTokenUsage).values({
    id: `tu_${Math.random().toString(36).slice(2)}${Date.now().toString(36).slice(-4)}`,
    userId: input.userId,
    agentId: input.agentId,
    rootAgentId: input.rootAgentId,
    sourceType: input.sourceType,
    sourceId: input.sourceId ?? null,
    inferenceProvider: input.inferenceProvider,
    requestedModel: input.model,
    generationId: input.actualCost?.generationId ?? input.generationId ?? null,
    upstreamProvider:
      input.actualCost?.upstreamProvider ?? input.upstreamProvider ?? null,
    billedModel,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    reasoningTokens: usage.reasoningTokens,
    cacheReadTokens: usage.cacheReadTokens,
    cacheWriteTokens: usage.cacheWriteTokens,
    totalTokens: usage.totalTokens,
    estimatedCostUsd: estimate.estimatedCostUsd,
    actualCostUsd: input.actualCost?.costUsd ?? null,
    costSource,
    pricingSnapshot: estimate.pricingSnapshot,
    costMetadata: {
      actual: input.actualCost?.costMetadata ?? null,
      actualUnavailableReason: input.actualCost
        ? null
        : (input.actualCostUnavailableReason ?? null),
      breakdown: estimate.breakdown,
      note: pricing ? null : 'pricing_unavailable',
    },
  })
}

function resolveCostSource(input: {
  hasActualCost: boolean
  hasPricing: boolean
}): 'actual' | 'estimated' | 'unknown' {
  if (input.hasActualCost) {
    return 'actual'
  }
  if (input.hasPricing) {
    return 'estimated'
  }
  return 'unknown'
}
