'use server'

import { revalidatePath } from 'next/cache'
import { requireUserId } from '@/auth/server/auth-guard'
import {
  clearUserAiGatewayApiKey,
  setUserAiGatewayApiKey,
} from '@/shared/server/ai-gateway-byok'
import { setUserTimezone } from '@/shared/server/user-timezone'

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

export async function syncBrowserTimezoneAction(browserTimezone: string) {
  const userId = await requireUserId()
  const detected = browserTimezone.trim()
  if (!detected) {
    return { ok: false as const, error: 'Could not detect a timezone.' }
  }
  const result = await setUserTimezone({
    userId,
    timezone: detected,
    source: 'auto',
  })
  if (!result.ok) {
    return result
  }
  revalidatePath('/settings')
  revalidatePath('/dashboard')
  return result
}

export async function saveAiGatewayKeyAction(apiKey: string) {
  const userId = await requireUserId()
  if (!apiKey.trim()) {
    return { ok: false, error: 'API key is required.' }
  }
  await setUserAiGatewayApiKey({ userId, apiKey })
  revalidatePath('/settings')
  return { ok: true }
}

export async function removeAiGatewayKeyAction() {
  const userId = await requireUserId()
  await clearUserAiGatewayApiKey(userId)
  revalidatePath('/settings')
  return { ok: true }
}
