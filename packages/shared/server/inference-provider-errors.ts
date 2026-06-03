import 'server-only'

import type { InferenceProvider } from '@outname/db/schema'
import { displayInferenceProvider } from './inference-provider-registry'

export class MissingInferenceCredentialError extends Error {
  readonly inferenceProvider: InferenceProvider

  constructor(inferenceProvider: InferenceProvider) {
    super(
      `Missing ${displayInferenceProvider(inferenceProvider)} key. Add your key in Settings before running agents.`
    )
    this.inferenceProvider = inferenceProvider
  }
}

export class InferenceCredentialVerificationError extends Error {
  readonly inferenceProvider: InferenceProvider
  readonly status?: number

  constructor(
    inferenceProvider: InferenceProvider,
    message: string,
    status?: number
  ) {
    super(message)
    this.inferenceProvider = inferenceProvider
    this.status = status
  }
}
