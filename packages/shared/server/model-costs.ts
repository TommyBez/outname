import 'server-only'

import {
  emptyModelPricing,
  type ModelPricing,
  type PricingTier,
} from '@outname/shared/model-pricing'
import type { LanguageModelResponseMetadata, LanguageModelUsage } from 'ai'
import Decimal from 'decimal.js'
import type { InferenceProvider } from './inference-providers'

export interface NormalizedUsage {
  cacheReadTokens: number
  cacheWriteTokens: number
  inputTokens: number
  outputTokens: number
  reasoningTokens: number
  totalTokens: number
}

export type { ModelPricing, PricingTier } from '@outname/shared/model-pricing'

export interface CostCategoryBreakdown {
  costUsd: string
  rateMissing: boolean
  rateUsdPerToken: string | null
  tokens: number
}

export interface EstimatedModelCost {
  breakdown: {
    cacheRead: CostCategoryBreakdown
    cacheWrite: CostCategoryBreakdown
    input: CostCategoryBreakdown
    output: CostCategoryBreakdown
    reasoning: CostCategoryBreakdown
  }
  estimatedCostUsd: string
  pricingSnapshot: Record<string, unknown>
  usage: NormalizedUsage
}

export interface ActualModelCost {
  billedModel?: string | null
  costMetadata: Record<string, unknown>
  costUsd: string
  generationId?: string
  source: 'generation_lookup' | 'response_usage'
  upstreamProvider?: string | null
}

export interface GenerationUsageObservation {
  generationId: string
  modelId: string
  rawUsage: Record<string, unknown> | null
  responseMetadata: {
    id: string
    modelId: string
  }
  usage: LanguageModelUsage
}

export interface UsageBearingStep {
  providerMetadata?: unknown
  response: Pick<LanguageModelResponseMetadata, 'id' | 'modelId'>
  usage: LanguageModelUsage
}

export interface UsageBearingResult {
  providerMetadata?: unknown
  response?: Pick<LanguageModelResponseMetadata, 'id' | 'modelId'>
  steps?: readonly UsageBearingStep[]
  totalUsage?: LanguageModelUsage
  usage?: LanguageModelUsage
}

const ZERO_COST = '0.000000000000'

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
  let cacheReadTokens = 0
  let cacheWriteTokens = 0
  let sawAny = false
  for (const step of steps) {
    const usage = step.usage
    if (!usage) {
      continue
    }
    const normalized = normalizeUsage(usage)
    sawAny = true
    inputTokens += normalized.inputTokens
    outputTokens += normalized.outputTokens
    totalTokens += normalized.totalTokens
    reasoningTokens += normalized.reasoningTokens
    cacheReadTokens += normalized.cacheReadTokens
    cacheWriteTokens += normalized.cacheWriteTokens
  }
  if (!sawAny) {
    return
  }

  return {
    cachedInputTokens: cacheReadTokens,
    inputTokenDetails: {
      cacheReadTokens,
      cacheWriteTokens,
      noCacheTokens: Math.max(
        0,
        inputTokens - cacheReadTokens - cacheWriteTokens
      ),
    },
    inputTokens,
    outputTokenDetails: {
      reasoningTokens,
      textTokens: Math.max(0, outputTokens - reasoningTokens),
    },
    outputTokens,
    reasoningTokens,
    totalTokens: totalTokens || inputTokens + outputTokens,
  } as LanguageModelUsage
}

export function buildGenerationUsageObservations(
  result: UsageBearingResult | undefined
): GenerationUsageObservation[] {
  if (!result) {
    return []
  }

  const steps = result.steps ?? []
  if (steps.length > 0) {
    return steps.map((step) =>
      generationUsageObservation({
        response: step.response,
        usage: step.usage,
      })
    )
  }

  if (!(result.response && result.usage)) {
    return []
  }

  return [
    generationUsageObservation({
      response: result.response,
      usage: result.usage,
    }),
  ]
}

export function normalizeUsage(
  usage: LanguageModelUsage | UsageInput | undefined
): NormalizedUsage {
  const value = usage ?? {}
  const inputTokenDetails = readRecord(value, 'inputTokenDetails')
  const outputTokenDetails = readRecord(value, 'outputTokenDetails')
  const inputTokens = numberOrZero(readField(value, 'inputTokens'))
  const outputTokens = numberOrZero(readField(value, 'outputTokens'))
  const cacheReadTokens = numberOrZero(
    inputTokenDetails?.cacheReadTokens ?? readField(value, 'cachedInputTokens')
  )
  const cacheWriteTokens = numberOrZero(inputTokenDetails?.cacheWriteTokens)
  const reasoningTokens = numberOrZero(
    outputTokenDetails?.reasoningTokens ?? readField(value, 'reasoningTokens')
  )
  const totalTokens =
    numberOrZero(readField(value, 'totalTokens')) || inputTokens + outputTokens

  return {
    cacheReadTokens,
    cacheWriteTokens,
    inputTokens,
    outputTokens,
    reasoningTokens,
    totalTokens,
  }
}

export function estimateModelCost(input: {
  pricing: ModelPricing | null
  usage: NormalizedUsage
}): EstimatedModelCost {
  const pricing = input.pricing ?? emptyModelPricing()
  const nonCachedInputTokens = Math.max(
    0,
    input.usage.inputTokens -
      input.usage.cacheReadTokens -
      input.usage.cacheWriteTokens
  )
  const inputCost = priceTokens({
    baseRate: pricing.input,
    tiers: pricing.inputTiers,
    tokens: nonCachedInputTokens,
  })
  const cacheReadCost = priceTokens({
    baseRate: pricing.cacheRead ?? pricing.input,
    tiers: pricing.cacheReadTiers,
    tokens: input.usage.cacheReadTokens,
  })
  const cacheWriteCost = priceTokens({
    baseRate: pricing.cacheWrite ?? pricing.input,
    tiers: pricing.cacheWriteTiers,
    tokens: input.usage.cacheWriteTokens,
  })
  const outputTokens = pricing.reasoning
    ? Math.max(0, input.usage.outputTokens - input.usage.reasoningTokens)
    : input.usage.outputTokens
  const outputCost = priceTokens({
    baseRate: pricing.output,
    tiers: pricing.outputTiers,
    tokens: outputTokens,
  })
  const reasoningCost = pricing.reasoning
    ? priceTokens({
        baseRate: pricing.reasoning,
        tiers: pricing.reasoningTiers,
        tokens: input.usage.reasoningTokens,
      })
    : zeroCost(input.usage.reasoningTokens)

  const estimated = inputCost.value
    .plus(cacheReadCost.value)
    .plus(cacheWriteCost.value)
    .plus(outputCost.value)
    .plus(reasoningCost.value)

  return {
    estimatedCostUsd: formatUsd(estimated),
    usage: input.usage,
    pricingSnapshot: pricingSnapshot(pricing),
    breakdown: {
      input: inputCost.breakdown,
      cacheRead: cacheReadCost.breakdown,
      cacheWrite: cacheWriteCost.breakdown,
      output: outputCost.breakdown,
      reasoning: reasoningCost.breakdown,
    },
  }
}

export function extractActualModelCostFromObservation(input: {
  observation: GenerationUsageObservation
  inferenceProvider: InferenceProvider
}): ActualModelCost | null {
  if (!input.observation.rawUsage) {
    return null
  }
  if (input.inferenceProvider === 'llm-gateway') {
    return extractActualLlmGatewayCost(input.observation)
  }
  if (input.inferenceProvider === 'openrouter') {
    return extractActualOpenRouterCost(input.observation)
  }
  return null
}

export function extractActualVercelGatewayCost(input: {
  generation: Record<string, unknown>
  generationId: string
}): ActualModelCost | null {
  const data = readRecordFromUnknown(input.generation.data)
  if (!data) {
    return null
  }
  const totalCost = decimalFromNumber(data.total_cost)
  if (!totalCost) {
    return null
  }

  return {
    billedModel: stringOrNull(data.model),
    costMetadata: {
      vercelAiGatewayGeneration: {
        generationTime: data.generation_time,
        isByok: data.is_byok,
        latency: data.latency,
        streamed: data.streamed,
        usage: data.usage,
      },
    },
    costUsd: formatUsd(totalCost),
    generationId: input.generationId,
    source: 'generation_lookup',
    upstreamProvider: stringOrNull(data.provider_name),
  }
}

function priceTokens(input: {
  baseRate: string | null
  tiers: PricingTier[]
  tokens: number
}): { breakdown: CostCategoryBreakdown; value: Decimal } {
  if (input.tokens <= 0) {
    return {
      breakdown: zeroBreakdown(0),
      value: new Decimal(0),
    }
  }

  const rate = selectRate(input.tokens, input.tiers) ?? input.baseRate
  if (!rate) {
    return {
      breakdown: {
        costUsd: ZERO_COST,
        rateMissing: true,
        rateUsdPerToken: null,
        tokens: input.tokens,
      },
      value: new Decimal(0),
    }
  }

  const value = new Decimal(input.tokens).times(rate)
  return {
    breakdown: {
      costUsd: formatUsd(value),
      rateMissing: false,
      rateUsdPerToken: rate,
      tokens: input.tokens,
    },
    value,
  }
}

function selectRate(tokens: number, tiers: PricingTier[]): string | null {
  const sortedTiers = [...tiers].sort((a, b) => a.min - b.min)
  let selectedRate: string | null = null
  for (const tier of sortedTiers) {
    if (tokens < tier.min) {
      break
    }
    if (tier.max !== undefined && tokens >= tier.max) {
      continue
    }
    selectedRate = tier.cost
  }
  return selectedRate
}

function zeroBreakdown(tokens: number): CostCategoryBreakdown {
  return {
    costUsd: ZERO_COST,
    rateMissing: false,
    rateUsdPerToken: null,
    tokens,
  }
}

function zeroCost(tokens: number): {
  breakdown: CostCategoryBreakdown
  value: Decimal
} {
  return {
    breakdown: zeroBreakdown(tokens),
    value: new Decimal(0),
  }
}

function pricingSnapshot(pricing: ModelPricing): Record<string, unknown> {
  return {
    cacheRead: pricing.cacheRead,
    cacheReadTiers: pricing.cacheReadTiers,
    cacheWrite: pricing.cacheWrite,
    cacheWriteTiers: pricing.cacheWriteTiers,
    input: pricing.input,
    inputTiers: pricing.inputTiers,
    output: pricing.output,
    outputTiers: pricing.outputTiers,
    reasoning: pricing.reasoning,
    reasoningTiers: pricing.reasoningTiers,
  }
}

function formatUsd(value: Decimal): string {
  return value.toFixed(12)
}

function generationUsageObservation(input: {
  response: Pick<LanguageModelResponseMetadata, 'id' | 'modelId'>
  usage: LanguageModelUsage
}): GenerationUsageObservation {
  return {
    generationId: input.response.id,
    modelId: input.response.modelId,
    rawUsage: rawUsageFromLanguageModelUsage(input.usage),
    responseMetadata: {
      id: input.response.id,
      modelId: input.response.modelId,
    },
    usage: input.usage,
  }
}

function extractActualLlmGatewayCost(
  observation: GenerationUsageObservation
): ActualModelCost | null {
  const usage = observation.rawUsage
  const totalCost =
    decimalFromNumber(usage?.cost_usd_total) ?? decimalFromNumber(usage?.cost)
  if (!totalCost) {
    return null
  }

  return {
    billedModel: observation.modelId,
    costUsd: formatUsd(totalCost),
    costMetadata: {
      llmGatewayUsage: usage,
    },
    generationId: observation.generationId,
    source: 'response_usage',
  }
}

function extractActualOpenRouterCost(
  observation: GenerationUsageObservation
): ActualModelCost | null {
  const usage = observation.rawUsage
  const totalCost = decimalFromNumber(usage?.cost)
  if (!totalCost) {
    return null
  }

  const costDetails = readRecordFromUnknown(usage?.cost_details)
  return {
    billedModel: observation.modelId,
    costUsd: formatUsd(totalCost),
    costMetadata: {
      currencySource: 'openrouter_usd_credits',
      openRouterUsage: {
        costDetails: costDetails
          ? {
              upstreamInferenceCost: costDetails.upstream_inference_cost,
            }
          : null,
        rawUsage: usage,
      },
    },
    generationId: observation.generationId,
    source: 'response_usage',
  }
}

function rawUsageFromLanguageModelUsage(
  usage: LanguageModelUsage
): Record<string, unknown> | null {
  const raw = (usage as Record<string, unknown>).raw
  return readRecordFromUnknown(raw)
}

function readRecordFromUnknown(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : null
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function decimalFromNumber(value: unknown): Decimal | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value >= 0 ? new Decimal(value) : null
  }
  return null
}

export interface UsageInput {
  cachedInputTokens?: number
  inputTokenDetails?: {
    cacheReadTokens?: number
    cacheWriteTokens?: number
    noCacheTokens?: number
  }
  inputTokens?: number
  outputTokenDetails?: {
    reasoningTokens?: number
    textTokens?: number
  }
  outputTokens?: number
  reasoningTokens?: number
  totalTokens?: number
}

function readField(value: object, key: keyof UsageInput): unknown {
  return (value as Record<string, unknown>)[key]
}

function readRecord(
  value: object,
  key: keyof UsageInput
): Record<string, unknown> | null {
  const field = readField(value, key)
  return field && typeof field === 'object'
    ? (field as Record<string, unknown>)
    : null
}

function numberOrZero(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return 0
  }
  return Math.floor(value)
}
