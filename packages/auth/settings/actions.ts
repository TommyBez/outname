'use server'

import { requireUserId } from '@outname/auth/server/auth-guard'
import type { InferenceProvider } from '@outname/db/schema'
import { InferenceCredentialVerificationError } from '@outname/shared/server/inference-provider-errors'
import {
  clearUserInferenceCredential,
  setDefaultInferenceProvider,
  setUserInferenceCredential,
} from '@outname/shared/server/inference-providers'
import {
  setUserTimezone,
  type TimezoneSetSource,
} from '@outname/shared/server/user-timezone'
import { revalidatePath } from 'next/cache'

export async function updateUserTimezoneAction(timezone: string) {
  const userId = await requireUserId()
  const result = await setUserTimezone({
    userId,
    timezone,
    source: 'manual',
  })
  if (!result.ok) {
    return result
  }
  revalidatePath('/settings')
  revalidatePath('/dashboard')
  return result
}

export async function syncBrowserTimezoneAction(
  browserTimezone: string,
  source: TimezoneSetSource = 'manual'
) {
  const userId = await requireUserId()
  const detected = browserTimezone.trim()
  if (!detected) {
    return { ok: false as const, error: 'Could not detect a timezone.' }
  }
  const result = await setUserTimezone({
    userId,
    timezone: detected,
    source,
  })
  if (!result.ok) {
    return result
  }
  revalidatePath('/settings')
  revalidatePath('/dashboard')
  return result
}

export async function saveInferenceProviderKeyAction(input: {
  apiKey: string
  inferenceProvider: InferenceProvider
}) {
  const userId = await requireUserId()
  if (!input.apiKey.trim()) {
    return { ok: false, error: 'API key is required.' }
  }
  try {
    await setUserInferenceCredential({
      userId,
      apiKey: input.apiKey,
      inferenceProvider: input.inferenceProvider,
    })
    revalidatePath('/settings')
    return { ok: true }
  } catch (error) {
    if (error instanceof InferenceCredentialVerificationError) {
      return { ok: false, error: error.message }
    }
    return { ok: false, error: 'Could not save API key.' }
  }
}

export async function removeInferenceProviderKeyAction(
  inferenceProvider: InferenceProvider
) {
  const userId = await requireUserId()
  await clearUserInferenceCredential({ userId, inferenceProvider })
  revalidatePath('/settings')
  return { ok: true }
}

export async function setDefaultInferenceProviderAction(
  inferenceProvider: InferenceProvider
) {
  const userId = await requireUserId()
  try {
    await setDefaultInferenceProvider({ userId, inferenceProvider })
    revalidatePath('/settings')
    return { ok: true }
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : 'Could not update default provider.',
    }
  }
}
