import 'server-only'

import type { InferenceProvider } from '@outname/db/schema'
import {
  clearUserInferenceCredential as clearStoredCredential,
  getRequiredDefaultInferenceProvider as getRequiredStoredDefaultProvider,
  getDefaultInferenceProvider as getStoredDefaultProvider,
  hasEnabledInferenceProvider as hasStoredEnabledProvider,
  listEnabledInferenceProviders as listStoredEnabledProviders,
  listUserInferenceProviderStates as listStoredProviderStates,
  setUserInferenceCredential as setStoredCredential,
  setDefaultInferenceProvider as setStoredDefaultProvider,
} from './inference-credentials'
import { getUserLanguageModel as getStoredUserLanguageModel } from './inference-language-model'
import {
  DEFAULT_INFERENCE_PROVIDER as DEFAULT_PROVIDER,
  displayInferenceProvider as displayProvider,
  isInferenceProvider as isKnownProvider,
  inferenceProviderKeyPlaceholder as providerKeyPlaceholder,
} from './inference-provider-registry'

export type { InferenceProvider } from '@outname/db/schema'
export type { UserInferenceProviderState } from './inference-credentials'

export const DEFAULT_INFERENCE_PROVIDER = DEFAULT_PROVIDER

export async function clearUserInferenceCredential(input: {
  inferenceProvider: InferenceProvider
  userId: string
}): Promise<void> {
  await clearStoredCredential(input)
}

export function displayInferenceProvider(provider: InferenceProvider): string {
  return displayProvider(provider)
}

export async function getDefaultInferenceProvider(
  userId: string
): Promise<InferenceProvider | null> {
  return await getStoredDefaultProvider(userId)
}

export async function getRequiredDefaultInferenceProvider(
  userId: string
): Promise<InferenceProvider> {
  return await getRequiredStoredDefaultProvider(userId)
}

export async function getUserLanguageModel(input: {
  inferenceProvider: InferenceProvider
  modelId: string
  userId: string
}): Promise<Awaited<ReturnType<typeof getStoredUserLanguageModel>>> {
  return await getStoredUserLanguageModel(input)
}

export async function hasEnabledInferenceProvider(input: {
  inferenceProvider: InferenceProvider
  userId: string
}): Promise<boolean> {
  return await hasStoredEnabledProvider(input)
}

export function inferenceProviderKeyPlaceholder(
  provider: InferenceProvider
): string {
  return providerKeyPlaceholder(provider)
}

export function isInferenceProvider(value: string): value is InferenceProvider {
  return isKnownProvider(value)
}

export async function listEnabledInferenceProviders(
  userId: string
): Promise<InferenceProvider[]> {
  return await listStoredEnabledProviders(userId)
}

export async function listUserInferenceProviderStates(
  userId: string
): Promise<Awaited<ReturnType<typeof listStoredProviderStates>>> {
  return await listStoredProviderStates(userId)
}

export async function setDefaultInferenceProvider(input: {
  inferenceProvider: InferenceProvider
  userId: string
}): Promise<void> {
  await setStoredDefaultProvider(input)
}

export async function setUserInferenceCredential(input: {
  apiKey: string
  inferenceProvider: InferenceProvider
  userId: string
}): Promise<void> {
  await setStoredCredential(input)
}
