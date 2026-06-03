import 'server-only'

import type { InferenceProvider } from '@outname/db/schema'
import type { ModelPricing, PricingTier } from './model-costs'

export interface ModelOption {
  contextWindow: number
  id: string
  inferenceProvider: InferenceProvider
  name: string
  ownedBy: string
  pricing: ModelPricing
  supportedParameters: string[]
}

const AI_GATEWAY_MODELS_ENDPOINT = 'https://ai-gateway.vercel.sh/v1/models'
const OPENROUTER_MODELS_ENDPOINT = 'https://openrouter.ai/api/v1/models'

export const DEFAULT_MODEL_BY_PROVIDER: Record<InferenceProvider, string> = {
  openrouter: 'deepseek/deepseek-v4-flash',
  'vercel-ai-gateway': 'deepseek/deepseek-v4-flash',
}

export const DEFAULT_MODEL_ID = DEFAULT_MODEL_BY_PROVIDER['vercel-ai-gateway']

const FALLBACK: Record<InferenceProvider, readonly ModelOption[]> = {
  openrouter: [
    fallbackModel({
      id: 'deepseek/deepseek-v4-flash',
      inferenceProvider: 'openrouter',
      name: 'DeepSeek: DeepSeek V4 Flash',
      ownedBy: 'deepseek',
    }),
    fallbackModel({
      id: 'openai/gpt-4o',
      inferenceProvider: 'openrouter',
      name: 'OpenAI: GPT-4o',
      ownedBy: 'openai',
    }),
  ],
  'vercel-ai-gateway': [
    fallbackModel({
      id: 'deepseek/deepseek-v4-flash',
      inferenceProvider: 'vercel-ai-gateway',
      name: 'DeepSeek V4 Flash',
      ownedBy: 'deepseek',
    }),
    fallbackModel({
      id: 'openai/gpt-5-mini',
      inferenceProvider: 'vercel-ai-gateway',
      name: 'GPT-5 Mini',
      ownedBy: 'openai',
    }),
  ],
}

interface AiGatewayRawModel {
  context_window?: number
  id?: string
  name?: string
  owned_by?: string
  pricing?: RawPricing
  tags?: string[]
  type?: string
}

interface OpenRouterRawModel {
  context_length?: number
  id?: string
  name?: string
  pricing?: RawOpenRouterPricing
  supported_parameters?: string[]
}

interface RawResponse<T> {
  data?: T[]
  object?: string
}

interface RawPricing {
  input?: number | string
  input_cache_read?: number | string
  input_cache_read_tiers?: RawPricingTier[]
  input_cache_write?: number | string
  input_cache_write_tiers?: RawPricingTier[]
  input_tiers?: RawPricingTier[]
  internal_reasoning?: number | string
  output?: number | string
  output_tiers?: RawPricingTier[]
}

interface RawOpenRouterPricing {
  completion?: number | string
  input_cache_read?: number | string
  input_cache_write?: number | string
  internal_reasoning?: number | string
  prompt?: number | string
}

interface RawPricingTier {
  cost?: number | string
  max?: number
  min?: number
}

export function getAvailableModels(input: {
  inferenceProvider: InferenceProvider
}): Promise<ModelOption[]> {
  return input.inferenceProvider === 'openrouter'
    ? getOpenRouterModels()
    : getAiGatewayModels()
}

export async function isModelSelectionValid(input: {
  inferenceProvider: InferenceProvider
  modelId: string
}): Promise<boolean> {
  const list = await getAvailableModels({
    inferenceProvider: input.inferenceProvider,
  })
  if (isFallbackList(input.inferenceProvider, list)) {
    return true
  }
  return list.some((option) => option.id === input.modelId)
}

export async function getModelPricing(input: {
  inferenceProvider: InferenceProvider
  modelId: string
}): Promise<ModelPricing | null> {
  const list = await getAvailableModels({
    inferenceProvider: input.inferenceProvider,
  })
  return list.find((model) => model.id === input.modelId)?.pricing ?? null
}

async function getAiGatewayModels(): Promise<ModelOption[]> {
  try {
    const response = await fetch(AI_GATEWAY_MODELS_ENDPOINT, {
      cache: 'force-cache',
      next: { revalidate: 3600 },
    })
    if (!response.ok) {
      console.error('getAiGatewayModels: non-OK response, using fallback', {
        status: response.status,
      })
      return [...FALLBACK['vercel-ai-gateway']]
    }

    const json = (await response.json()) as RawResponse<AiGatewayRawModel>
    const models = Array.isArray(json.data) ? json.data : []
    const mapped: ModelOption[] = []
    for (const model of models) {
      if (!isAiGatewayToolLanguageModel(model)) {
        continue
      }
      mapped.push(aiGatewayModelToOption(model))
    }
    return sortedOrFallback('vercel-ai-gateway', mapped)
  } catch (error) {
    console.error('getAiGatewayModels: fetch threw, using fallback', error)
    return [...FALLBACK['vercel-ai-gateway']]
  }
}

async function getOpenRouterModels(): Promise<ModelOption[]> {
  try {
    const response = await fetch(OPENROUTER_MODELS_ENDPOINT, {
      cache: 'force-cache',
      next: { revalidate: 3600 },
    })
    if (!response.ok) {
      console.error('getOpenRouterModels: non-OK response, using fallback', {
        status: response.status,
      })
      return [...FALLBACK.openrouter]
    }

    const json = (await response.json()) as RawResponse<OpenRouterRawModel>
    const models = Array.isArray(json.data) ? json.data : []
    const mapped: ModelOption[] = []
    for (const model of models) {
      if (!isOpenRouterToolModel(model)) {
        continue
      }
      mapped.push(openRouterModelToOption(model))
    }
    return sortedOrFallback('openrouter', mapped)
  } catch (error) {
    console.error('getOpenRouterModels: fetch threw, using fallback', error)
    return [...FALLBACK.openrouter]
  }
}

function isAiGatewayToolLanguageModel(
  model: AiGatewayRawModel
): model is AiGatewayRawModel & { id: string } {
  if (!model.id || typeof model.id !== 'string') {
    return false
  }
  if (model.type !== 'language') {
    return false
  }
  return Boolean(Array.isArray(model.tags) && model.tags.includes('tool-use'))
}

function isOpenRouterToolModel(
  model: OpenRouterRawModel
): model is OpenRouterRawModel & { id: string } {
  if (!model.id || typeof model.id !== 'string') {
    return false
  }
  if (model.id.startsWith('openrouter/')) {
    return false
  }
  return Boolean(
    Array.isArray(model.supported_parameters) &&
      model.supported_parameters.includes('tools')
  )
}

function aiGatewayModelToOption(
  model: AiGatewayRawModel & { id: string }
): ModelOption {
  return {
    contextWindow: positiveInteger(model.context_window),
    id: model.id,
    inferenceProvider: 'vercel-ai-gateway',
    name: nonEmptyString(model.name) ?? model.id,
    ownedBy: nonEmptyString(model.owned_by) ?? ownerFromModelId(model.id),
    pricing: rawPricingToModelPricing(model.pricing ?? {}),
    supportedParameters: ['tools'],
  }
}

function openRouterModelToOption(
  model: OpenRouterRawModel & { id: string }
): ModelOption {
  return {
    contextWindow: positiveInteger(model.context_length),
    id: model.id,
    inferenceProvider: 'openrouter',
    name: nonEmptyString(model.name) ?? model.id,
    ownedBy: ownerFromModelId(model.id),
    pricing: openRouterPricingToModelPricing(model.pricing ?? {}),
    supportedParameters: model.supported_parameters ?? [],
  }
}

function rawPricingToModelPricing(pricing: RawPricing): ModelPricing {
  return {
    cacheRead: parseRate(pricing.input_cache_read),
    cacheReadTiers: parseTiers(pricing.input_cache_read_tiers),
    cacheWrite: parseRate(pricing.input_cache_write),
    cacheWriteTiers: parseTiers(pricing.input_cache_write_tiers),
    input: parseRate(pricing.input),
    inputTiers: parseTiers(pricing.input_tiers),
    output: parseRate(pricing.output),
    outputTiers: parseTiers(pricing.output_tiers),
    reasoning: parseRate(pricing.internal_reasoning),
    reasoningTiers: [],
  }
}

function openRouterPricingToModelPricing(
  pricing: RawOpenRouterPricing
): ModelPricing {
  return {
    cacheRead: parseRate(pricing.input_cache_read),
    cacheReadTiers: [],
    cacheWrite: parseRate(pricing.input_cache_write),
    cacheWriteTiers: [],
    input: parseRate(pricing.prompt),
    inputTiers: [],
    output: parseRate(pricing.completion),
    outputTiers: [],
    reasoning: parseRate(pricing.internal_reasoning),
    reasoningTiers: [],
  }
}

function parseTiers(value: RawPricingTier[] | undefined): PricingTier[] {
  if (!Array.isArray(value)) {
    return []
  }
  const tiers: PricingTier[] = []
  for (const tier of value) {
    const cost = parseRate(tier.cost)
    if (!cost || typeof tier.min !== 'number' || tier.min < 0) {
      continue
    }
    tiers.push({
      cost,
      min: Math.floor(tier.min),
      ...(typeof tier.max === 'number' && tier.max > tier.min
        ? { max: Math.floor(tier.max) }
        : {}),
    })
  }
  return tiers
}

function parseRate(value: number | string | undefined): string | null {
  if (value === undefined || value === null) {
    return null
  }
  const asString = typeof value === 'number' ? String(value) : value.trim()
  if (!asString) {
    return null
  }
  const numeric = Number(asString)
  if (!Number.isFinite(numeric) || numeric < 0) {
    return null
  }
  return asString
}

function sortedOrFallback(
  provider: InferenceProvider,
  models: ModelOption[]
): ModelOption[] {
  if (models.length === 0) {
    console.error(
      `getAvailableModels: zero tool-capable models for ${provider}, using fallback`
    )
    return [...FALLBACK[provider]]
  }
  return models.toSorted((a, b) => {
    if (a.ownedBy !== b.ownedBy) {
      return a.ownedBy.localeCompare(b.ownedBy)
    }
    return a.id.localeCompare(b.id)
  })
}

function isFallbackList(
  provider: InferenceProvider,
  models: ModelOption[]
): boolean {
  const fallback = FALLBACK[provider]
  return (
    models.length === fallback.length &&
    models.every((model, index) => model.id === fallback[index]?.id)
  )
}

function fallbackModel(input: {
  id: string
  inferenceProvider: InferenceProvider
  name: string
  ownedBy: string
}): ModelOption {
  return {
    contextWindow: 0,
    id: input.id,
    inferenceProvider: input.inferenceProvider,
    name: input.name,
    ownedBy: input.ownedBy,
    pricing: rawPricingToModelPricing({}),
    supportedParameters: ['tools'],
  }
}

function ownerFromModelId(modelId: string): string {
  return modelId.split('/')[0] ?? 'unknown'
}

function positiveInteger(value: number | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : 0
}

function nonEmptyString(value: string | undefined): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null
}
