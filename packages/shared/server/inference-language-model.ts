import 'server-only'

import type { InferenceProvider } from '@outname/db/schema'
import { readUserInferenceCredentialApiKey } from './inference-credentials'
import { createProviderLanguageModel } from './inference-provider-registry'

export async function getUserLanguageModel(input: {
  inferenceProvider: InferenceProvider
  modelId: string
  userId: string
}) {
  const apiKey = await readUserInferenceCredentialApiKey({
    inferenceProvider: input.inferenceProvider,
    userId: input.userId,
  })

  return createProviderLanguageModel({
    apiKey,
    inferenceProvider: input.inferenceProvider,
    modelId: input.modelId,
  })
}
