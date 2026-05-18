import 'server-only'
import { createGateway } from 'ai'
import { eq } from 'drizzle-orm'
import { decryptCredential, encryptCredential } from '@/connections/crypto'
import { db } from '@/shared/db'
import { user } from '@/shared/db/schema'

export class MissingAiGatewayApiKeyError extends Error {
  constructor() {
    super(
      'Missing AI Gateway API key. Add your key in Settings before running agents.'
    )
  }
}

export async function setUserAiGatewayApiKey(input: {
  apiKey: string
  userId: string
}): Promise<void> {
  const encrypted = await encryptCredential({ apiKey: input.apiKey.trim() })
  await db
    .update(user)
    .set({ aiGatewayApiKey: encrypted })
    .where(eq(user.id, input.userId))
}

export async function clearUserAiGatewayApiKey(userId: string): Promise<void> {
  await db.update(user).set({ aiGatewayApiKey: null }).where(eq(user.id, userId))
}

export async function hasUserAiGatewayApiKey(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ aiGatewayApiKey: user.aiGatewayApiKey })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1)
  return Boolean(row?.aiGatewayApiKey)
}

export async function getUserModelForGateway(input: {
  modelId: string
  userId: string
}) {
  const [row] = await db
    .select({ aiGatewayApiKey: user.aiGatewayApiKey })
    .from(user)
    .where(eq(user.id, input.userId))
    .limit(1)
  if (!row?.aiGatewayApiKey) {
    throw new MissingAiGatewayApiKeyError()
  }
  const decrypted = await decryptCredential<{ apiKey?: string }>(
    row.aiGatewayApiKey
  )
  const apiKey = decrypted.apiKey?.trim()
  if (!apiKey) {
    throw new MissingAiGatewayApiKeyError()
  }
  const gateway = createGateway({
    apiKey,
  })
  return gateway(input.modelId)
}
