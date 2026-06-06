import 'server-only'

import type { InferenceProvider } from '@outname/db/schema'
import {
  emptyModelPricing,
  type ModelPricing,
  type PricingTier,
} from '@outname/shared/model-pricing'

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
const LLM_GATEWAY_MODELS_ENDPOINT = 'https://api.llmgateway.io/v1/models'
const OPENROUTER_MODELS_ENDPOINT = 'https://openrouter.ai/api/v1/models'
const MODEL_CATALOG_REVALIDATE_SECONDS = 3600
const MODEL_CATALOG_REVALIDATE_MS = MODEL_CATALOG_REVALIDATE_SECONDS * 1000

export const DEFAULT_MODEL_BY_PROVIDER: Record<InferenceProvider, string> = {
  'llm-gateway': 'deepseek/deepseek-v4-flash',
  openrouter: 'deepseek/deepseek-v4-flash',
  'vercel-ai-gateway': 'deepseek/deepseek-v4-flash',
}

export const DEFAULT_MODEL_ID = DEFAULT_MODEL_BY_PROVIDER['vercel-ai-gateway']

const FALLBACK_MODELS: Record<InferenceProvider, readonly ModelOption[]> = {
  'llm-gateway': [
    fallbackModel({
      id: 'deepseek/deepseek-v4-flash',
      inferenceProvider: 'llm-gateway',
      name: 'DeepSeek V4 Flash',
      ownedBy: 'deepseek',
    }),
    fallbackModel({
      id: 'gpt-5.4-mini',
      inferenceProvider: 'llm-gateway',
      name: 'GPT-5.4 Mini',
      ownedBy: 'openai',
    }),
  ],
  openrouter: [
    fallbackModel({
      id: 'deepseek/deepseek-v4-flash',
      inferenceProvider: 'openrouter',
      name: 'DeepSeek: DeepSeek V4 Flash',
      ownedBy: 'deepseek',
    }),
    fallbackModel({
      id: 'openai/gpt-5.4-mini',
      inferenceProvider: 'openrouter',
      name: 'GPT-5.4 Mini',
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
      id: 'openai/gpt-5.4-mini',
      inferenceProvider: 'vercel-ai-gateway',
      name: 'GPT-5.4 Mini',
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
  providers?: RawLlmGatewayProvider[]
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
  image?: number | string
  input_cache_read?: number | string
  input_cache_write?: number | string
  internal_reasoning?: number | string
  prompt?: number | string
  request?: number | string
  web_search?: number | string
}

interface RawLlmGatewayProvider {
  providerId?: string
  tools?: boolean
}

interface RawPricingTier {
  cost?: number | string
  max?: number
  min?: number
}

type ModelCatalogSource = 'fallback' | 'live'

interface ModelCatalog {
  models: ModelOption[]
  pricingByModelId: Map<string, ModelPricing>
  source: ModelCatalogSource
}

interface ModelCatalogDefinition {
  endpoint: string
  fallbackModels: readonly ModelOption[]
  isToolModel: (model: unknown) => boolean
  provider: InferenceProvider
  toOption: (model: unknown) => ModelOption
}

const MODEL_CATALOG_DEFINITIONS = {
  'llm-gateway': {
    endpoint: LLM_GATEWAY_MODELS_ENDPOINT,
    fallbackModels: FALLBACK_MODELS['llm-gateway'],
    isToolModel: isLlmGatewayToolModel,
    provider: 'llm-gateway',
    toOption: (model) =>
      llmGatewayModelToOption(model as OpenRouterRawModel & { id: string }),
  },
  openrouter: {
    endpoint: OPENROUTER_MODELS_ENDPOINT,
    fallbackModels: FALLBACK_MODELS.openrouter,
    isToolModel: isOpenRouterToolModel,
    provider: 'openrouter',
    toOption: (model) =>
      openRouterModelToOption(model as OpenRouterRawModel & { id: string }),
  },
  'vercel-ai-gateway': {
    endpoint: AI_GATEWAY_MODELS_ENDPOINT,
    fallbackModels: FALLBACK_MODELS['vercel-ai-gateway'],
    isToolModel: isAiGatewayToolLanguageModel,
    provider: 'vercel-ai-gateway',
    toOption: (model) =>
      aiGatewayModelToOption(model as AiGatewayRawModel & { id: string }),
  },
} satisfies Record<InferenceProvider, ModelCatalogDefinition>

const modelCatalogCache = new Map<
  InferenceProvider,
  { expiresAt: number; promise: Promise<ModelCatalog> }
>()

export async function getAvailableModels(input: {
  inferenceProvider: InferenceProvider
}): Promise<ModelOption[]> {
  return (await getModelCatalog(input)).models
}

export async function isModelSelectionValid(input: {
  inferenceProvider: InferenceProvider
  modelId: string
}): Promise<boolean> {
  const catalog = await getModelCatalog({
    inferenceProvider: input.inferenceProvider,
  })
  if (catalog.source === 'fallback') {
    return true
  }
  return catalog.pricingByModelId.has(input.modelId)
}

export async function getModelPricing(input: {
  inferenceProvider: InferenceProvider
  modelId: string
}): Promise<ModelPricing | null> {
  const catalog = await getModelCatalog({
    inferenceProvider: input.inferenceProvider,
  })
  return catalog.pricingByModelId.get(input.modelId) ?? null
}

async function getModelCatalog(input: {
  inferenceProvider: InferenceProvider
}): Promise<ModelCatalog> {
  const now = Date.now()
  const cached = modelCatalogCache.get(input.inferenceProvider)
  if (cached && cached.expiresAt > now) {
    return await cached.promise
  }

  const definition = MODEL_CATALOG_DEFINITIONS[input.inferenceProvider]
  const promise = fetchModelCatalog(definition)
  modelCatalogCache.set(input.inferenceProvider, {
    expiresAt: now + MODEL_CATALOG_REVALIDATE_MS,
    promise,
  })
  return await promise
}

async function fetchModelCatalog(
  definition: ModelCatalogDefinition
): Promise<ModelCatalog> {
  try {
    const response = await fetch(definition.endpoint, {
      cache: 'force-cache',
      next: { revalidate: MODEL_CATALOG_REVALIDATE_SECONDS },
    })
    if (!response.ok) {
      console.error('getAvailableModels: non-OK response, using fallback', {
        provider: definition.provider,
        status: response.status,
      })
      return fallbackCatalog(definition)
    }

    const json = (await response.json()) as RawResponse<unknown>
    const models = Array.isArray(json.data) ? json.data : []
    const mapped: ModelOption[] = []
    for (const model of models) {
      if (!definition.isToolModel(model)) {
        continue
      }
      mapped.push(definition.toOption(model))
    }
    return liveCatalogOrFallback(definition, mapped)
  } catch (error) {
    console.error('getAvailableModels: fetch threw, using fallback', {
      error,
      provider: definition.provider,
    })
    return fallbackCatalog(definition)
  }
}

function isAiGatewayToolLanguageModel(
  model: unknown
): model is AiGatewayRawModel & { id: string } {
  if (!model || typeof model !== 'object') {
    return false
  }
  const value = model as AiGatewayRawModel
  if (!value.id || typeof value.id !== 'string') {
    return false
  }
  if (value.type !== 'language') {
    return false
  }
  return Boolean(Array.isArray(value.tags) && value.tags.includes('tool-use'))
}

function isOpenRouterToolModel(
  model: unknown
): model is OpenRouterRawModel & { id: string } {
  if (!model || typeof model !== 'object') {
    return false
  }
  const value = model as OpenRouterRawModel
  if (!value.id || typeof value.id !== 'string') {
    return false
  }
  if (value.id.startsWith('openrouter/')) {
    return false
  }
  return Boolean(
    Array.isArray(value.supported_parameters) &&
      value.supported_parameters.includes('tools')
  )
}

function isLlmGatewayToolModel(
  model: unknown
): model is OpenRouterRawModel & { id: string } {
  if (!model || typeof model !== 'object') {
    return false
  }
  const value = model as OpenRouterRawModel
  if (!value.id || typeof value.id !== 'string') {
    return false
  }
  if (
    Array.isArray(value.supported_parameters) &&
    value.supported_parameters.includes('tools')
  ) {
    return true
  }
  return Boolean(
    Array.isArray(value.providers) &&
      value.providers.some((provider) => provider.tools === true)
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

function llmGatewayModelToOption(
  model: OpenRouterRawModel & { id: string }
): ModelOption {
  return {
    contextWindow: positiveInteger(model.context_length),
    id: model.id,
    inferenceProvider: 'llm-gateway',
    name: nonEmptyString(model.name) ?? model.id,
    ownedBy: ownerFromModelId(model.id),
    pricing: openRouterPricingToModelPricing(model.pricing ?? {}),
    supportedParameters: model.supported_parameters ?? [],
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

function liveCatalogOrFallback(
  definition: ModelCatalogDefinition,
  models: ModelOption[]
): ModelCatalog {
  if (models.length === 0) {
    console.error(
      `getAvailableModels: zero tool-capable models for ${definition.provider}, using fallback`
    )
    return fallbackCatalog(definition)
  }
  return createCatalog({
    models: sortedModels(models),
    source: 'live',
  })
}

function fallbackCatalog(definition: ModelCatalogDefinition): ModelCatalog {
  return createCatalog({
    models: [...definition.fallbackModels],
    source: 'fallback',
  })
}

function createCatalog(input: {
  models: ModelOption[]
  source: ModelCatalogSource
}): ModelCatalog {
  return {
    models: input.models,
    pricingByModelId: new Map(
      input.models.map((model) => [model.id, model.pricing])
    ),
    source: input.source,
  }
}

function sortedModels(models: ModelOption[]): ModelOption[] {
  return models.toSorted((a, b) => {
    if (a.ownedBy !== b.ownedBy) {
      return a.ownedBy.localeCompare(b.ownedBy)
    }
    return a.id.localeCompare(b.id)
  })
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
    pricing: emptyModelPricing(),
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
