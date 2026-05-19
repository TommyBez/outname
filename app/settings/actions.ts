'use server'

import { revalidatePath } from 'next/cache'
import { requireUserId } from '@/auth/server/auth-guard'
import {
  clearUserAiGatewayApiKey,
  setUserAiGatewayApiKey,
} from '@/shared/server/ai-gateway-byok'

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
