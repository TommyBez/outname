import 'server-only'

import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import {
  type InferenceProvider,
  inferenceProviderValues,
} from '@outname/db/schema'
import { createGateway } from 'ai'

export type { InferenceProvider } from '@outname/db/schema'

export const DEFAULT_INFERENCE_PROVIDER: InferenceProvider = 'vercel-ai-gateway'

type ProviderLanguageModel = ReturnType<ReturnType<typeof createGateway>>

const OPENROUTER_EXTRA_BODY = {
  provider: {
    allow_fallbacks: false,
    require_parameters: true,
  },
} as const

interface ProviderDefinition {
  createLanguageModel: (input: {
    apiKey: string
    modelId: string
  }) => ProviderLanguageModel
  keyPlaceholder: string
  label: string
  summarizeVerificationBody: (
    body: Record<string, unknown>
  ) => Record<string, unknown>
  verifyUrl: string
}

const PROVIDER_DEFINITIONS = {
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
    keyPlaceholder: 'sk-or-...',
    label: 'OpenRouter',
    summarizeVerificationBody: (body) => ({
      label: body.label,
      limit: body.limit,
      usage: body.usage,
      isFreeTier: body.is_free_tier,
    }),
    verifyUrl: 'https://openrouter.ai/api/v1/key',
  },
  'vercel-ai-gateway': {
    createLanguageModel: ({ apiKey, modelId }) => {
      const gateway = createGateway({ apiKey })
      return gateway(modelId)
    },
    keyPlaceholder: 'vck_...',
    label: 'Vercel AI Gateway',
    summarizeVerificationBody: (body) => ({
      balance: body.balance,
      totalUsed: body.total_used,
    }),
    verifyUrl: 'https://ai-gateway.vercel.sh/v1/credits',
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

export function inferenceProviderVerifyUrl(
  provider: InferenceProvider
): string {
  return PROVIDER_DEFINITIONS[provider].verifyUrl
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
