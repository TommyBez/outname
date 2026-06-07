import 'server-only'

import { createLLMGateway } from '@llmgateway/ai-sdk-provider'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import {
  type InferenceProvider,
  inferenceProviderValues,
} from '@outname/db/schema'
import { createGateway } from 'ai'

export type { InferenceProvider } from '@outname/db/schema'

export const DEFAULT_INFERENCE_PROVIDER: InferenceProvider = 'vercel-ai-gateway'

type LlmGatewayModelId = Parameters<ReturnType<typeof createLLMGateway>>[0]
type ProviderLanguageModel = ReturnType<ReturnType<typeof createGateway>>

const OPENROUTER_EXTRA_BODY = {
  provider: {
    allow_fallbacks: false,
    require_parameters: true,
  },
} as const

interface ProviderDefinition {
  createGenerationLookupRequest?: (input: {
    apiKey: string
    generationId: string
  }) => ProviderGenerationLookupRequest
  createLanguageModel: (input: {
    apiKey: string
    modelId: string
  }) => ProviderLanguageModel
  createVerificationRequest?: (apiKey: string) => ProviderVerificationRequest
  keyPlaceholder: string
  label: string
  summarizeVerificationBody: (
    body: Record<string, unknown>
  ) => Record<string, unknown>
}

interface ProviderVerificationRequest {
  init?: RequestInit
  url: string
}

interface ProviderGenerationLookupRequest {
  init?: RequestInit
  url: string
}

const PROVIDER_DEFINITIONS = {
  'llm-gateway': {
    createLanguageModel: ({ apiKey, modelId }) => {
      const llmGateway = createLLMGateway({
        apiKey,
        compatibility: 'strict',
      })
      return llmGateway(modelId as LlmGatewayModelId)
    },
    keyPlaceholder: 'llmgtwy_...',
    label: 'LLM Gateway',
    summarizeVerificationBody: (body) => ({
      id: body.id,
      model: body.model,
      usage: body.usage,
    }),
  },
  openrouter: {
    createLanguageModel: ({ apiKey, modelId }) => {
      const openrouter = createOpenRouter({
        apiKey,
        appName: 'OUTNA.ME',
        compatibility: 'strict',
        extraBody: OPENROUTER_EXTRA_BODY,
      })
      return openrouter(modelId)
    },
    createVerificationRequest: (apiKey) => ({
      url: 'https://openrouter.ai/api/v1/key',
      init: {
        headers: {
          authorization: `Bearer ${apiKey}`,
        },
      },
    }),
    keyPlaceholder: 'sk-or-...',
    label: 'OpenRouter',
    summarizeVerificationBody: (body) => ({
      label: body.label,
      limit: body.limit,
      usage: body.usage,
      isFreeTier: body.is_free_tier,
    }),
  },
  'vercel-ai-gateway': {
    createLanguageModel: ({ apiKey, modelId }) => {
      const gateway = createGateway({ apiKey })
      return gateway(modelId)
    },
    createGenerationLookupRequest: ({ apiKey, generationId }) => ({
      url: `https://ai-gateway.vercel.sh/v1/generation?id=${encodeURIComponent(generationId)}`,
      init: {
        headers: {
          authorization: `Bearer ${apiKey}`,
        },
      },
    }),
    createVerificationRequest: (apiKey) => ({
      url: 'https://ai-gateway.vercel.sh/v1/credits',
      init: {
        headers: {
          authorization: `Bearer ${apiKey}`,
        },
      },
    }),
    keyPlaceholder: 'vck_...',
    label: 'Vercel AI Gateway',
    summarizeVerificationBody: (body) => ({
      balance: body.balance,
      totalUsed: body.total_used,
    }),
  },
} satisfies Record<InferenceProvider, ProviderDefinition>

export function createProviderLanguageModel(input: {
  apiKey: string
  inferenceProvider: InferenceProvider
  modelId: string
}): ProviderLanguageModel {
  return PROVIDER_DEFINITIONS[input.inferenceProvider].createLanguageModel({
    apiKey: input.apiKey,
    modelId: input.modelId,
  })
}

export function displayInferenceProvider(provider: InferenceProvider): string {
  return PROVIDER_DEFINITIONS[provider].label
}

export function isInferenceProvider(value: string): value is InferenceProvider {
  return inferenceProviderValues.includes(value as InferenceProvider)
}

export function inferenceProviderKeyPlaceholder(
  provider: InferenceProvider
): string {
  return PROVIDER_DEFINITIONS[provider].keyPlaceholder
}

export function inferenceProviderVerificationRequest(input: {
  apiKey: string
  provider: InferenceProvider
}): ProviderVerificationRequest | null {
  const definition = PROVIDER_DEFINITIONS[input.provider] as ProviderDefinition
  return definition.createVerificationRequest?.(input.apiKey) ?? null
}

export function inferenceProviderGenerationLookupRequest(input: {
  apiKey: string
  generationId: string
  provider: InferenceProvider
}): ProviderGenerationLookupRequest | null {
  const definition = PROVIDER_DEFINITIONS[input.provider] as ProviderDefinition
  return (
    definition.createGenerationLookupRequest?.({
      apiKey: input.apiKey,
      generationId: input.generationId,
    }) ?? null
  )
}

export function summarizeProviderVerificationBody(input: {
  body: unknown
  inferenceProvider: InferenceProvider
}): Record<string, unknown> {
  if (!input.body || typeof input.body !== 'object') {
    return {}
  }
  return PROVIDER_DEFINITIONS[
    input.inferenceProvider
  ].summarizeVerificationBody(input.body as Record<string, unknown>)
}
