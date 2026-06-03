import 'server-only'

import { db } from '@outname/db'
import { agentTokenUsage } from '@outname/db/schema'
import { getModelPricing } from '@outname/shared/server/inference-models'
import type { InferenceProvider } from '@outname/shared/server/inference-providers'
import {
  estimateModelCost,
  normalizeUsage,
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
  usage: LanguageModelUsage | UsageInput | undefined
}): Promise<void> {
  const usage = normalizeUsage(input.usage)
  if (
    usage.inputTokens === 0 &&
    usage.outputTokens === 0 &&
    usage.totalTokens === 0 &&
    usage.reasoningTokens === 0 &&
    usage.cacheReadTokens === 0 &&
    usage.cacheWriteTokens === 0
  ) {
    return
  }

  const pricing = await getModelPricing({
    inferenceProvider: input.inferenceProvider,
    modelId: input.model,
  }).catch(() => null)
  const estimate = estimateModelCost({ pricing, usage })

  await db.insert(agentTokenUsage).values({
    id: `tu_${Math.random().toString(36).slice(2)}${Date.now().toString(36).slice(-4)}`,
    userId: input.userId,
    agentId: input.agentId,
    rootAgentId: input.rootAgentId,
    sourceType: input.sourceType,
    sourceId: input.sourceId ?? null,
    inferenceProvider: input.inferenceProvider,
    requestedModel: input.model,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    reasoningTokens: usage.reasoningTokens,
    cacheReadTokens: usage.cacheReadTokens,
    cacheWriteTokens: usage.cacheWriteTokens,
    totalTokens: usage.totalTokens,
    estimatedCostUsd: estimate.estimatedCostUsd,
    actualCostUsd: null,
    costSource: pricing ? 'estimated' : 'unknown',
    pricingSnapshot: estimate.pricingSnapshot,
    costMetadata: {
      breakdown: estimate.breakdown,
      note: pricing ? null : 'pricing_unavailable',
    },
  })
}

interface UsageInput {
  cachedInputTokens?: number
  inputTokenDetails?: {
    cacheReadTokens?: number
    cacheWriteTokens?: number
  }
  inputTokens?: number
  outputTokenDetails?: {
    reasoningTokens?: number
  }
  outputTokens?: number
  reasoningTokens?: number
  totalTokens?: number
}
