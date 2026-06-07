import 'server-only'

import type { InferenceProvider } from '@outname/db/schema'
import { InferenceCredentialVerificationError } from './inference-provider-errors'
import {
  displayInferenceProvider,
  inferenceProviderVerificationRequest,
  summarizeProviderVerificationBody,
} from './inference-provider-registry'

export async function verifyInferenceCredential(input: {
  apiKey: string
  inferenceProvider: InferenceProvider
}): Promise<Record<string, unknown>> {
  const request = inferenceProviderVerificationRequest({
    apiKey: input.apiKey,
    provider: input.inferenceProvider,
  })

  if (!request) {
    return {
      providerStatus: 'verification_skipped',
      verifiedAt: new Date().toISOString(),
      verification: {
        reason: 'no_non_billable_verification_endpoint',
      },
    }
  }

  let response: Response
  try {
    response = await fetch(request.url, {
      ...request.init,
      cache: 'no-store',
    })
  } catch {
    throw new InferenceCredentialVerificationError(
      input.inferenceProvider,
      `Could not verify ${displayInferenceProvider(input.inferenceProvider)} right now. Try again in a moment.`
    )
  }

  if (!response.ok) {
    throw new InferenceCredentialVerificationError(
      input.inferenceProvider,
      verificationErrorMessage(input.inferenceProvider, response.status),
      response.status
    )
  }

  const body = await response.json().catch(() => ({}))
  return {
    providerStatus: response.status,
    verifiedAt: new Date().toISOString(),
    verification: summarizeProviderVerificationBody({
      body,
      inferenceProvider: input.inferenceProvider,
    }),
  }
}

function verificationErrorMessage(
  provider: InferenceProvider,
  status: number
): string {
  if (status === 401 || status === 403) {
    return `${displayInferenceProvider(provider)} rejected this API key.`
  }
  return `${displayInferenceProvider(provider)} key verification failed with status ${status}.`
}
