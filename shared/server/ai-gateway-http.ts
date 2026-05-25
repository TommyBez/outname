import 'server-only'

import { NextResponse } from 'next/server'
import {
  AI_GATEWAY_API_KEY_MISSING_CODE,
  AI_GATEWAY_API_KEY_MISSING_MESSAGE,
  AI_GATEWAY_API_KEY_MISSING_STATUS,
} from '@/shared/ai-gateway/errors'
import { hasUserAiGatewayApiKey } from '@/shared/server/ai-gateway-byok'

export function missingAiGatewayApiKeyResponse() {
  return NextResponse.json(
    {
      error: AI_GATEWAY_API_KEY_MISSING_CODE,
      message: AI_GATEWAY_API_KEY_MISSING_MESSAGE,
    },
    { status: AI_GATEWAY_API_KEY_MISSING_STATUS }
  )
}

export async function ensureUserAiGatewayApiKey(
  userId: string
): Promise<ReturnType<typeof missingAiGatewayApiKeyResponse> | null> {
  const hasKey = await hasUserAiGatewayApiKey(userId)
  if (!hasKey) {
    return missingAiGatewayApiKeyResponse()
  }
  return null
}
