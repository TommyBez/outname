import 'server-only'
import { createGateway } from 'ai'
import { eq } from 'drizzle-orm'
import { decryptCredential, encryptCredential } from '@/connections/crypto'
import { db } from '@/shared/db'
import { user } from '@/shared/db/schema'
import { getUpstashRedis } from '@/shared/server/upstash-redis'

const AI_GATEWAY_API_KEY_CACHE_SUFFIX = 'ai-gateway-api-key'

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
  await writeCachedUserAiGatewayApiKey({
    encrypted,
    userId: input.userId,
  }).catch(() => undefined)
}

export async function clearUserAiGatewayApiKey(userId: string): Promise<void> {
  await db
    .update(user)
    .set({ aiGatewayApiKey: null })
    .where(eq(user.id, userId))
  await clearCachedUserAiGatewayApiKey(userId).catch(() => undefined)
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
  const encrypted = await readEncryptedUserAiGatewayApiKey(input.userId)
  if (!encrypted) {
    throw new MissingAiGatewayApiKeyError()
  }
  const decrypted = await decryptCredential<{ apiKey?: string }>(encrypted)
  const apiKey = decrypted.apiKey?.trim()
  if (!apiKey) {
    throw new MissingAiGatewayApiKeyError()
  }
  const gateway = createGateway({
    apiKey,
  })
  return gateway(input.modelId)
}

async function readEncryptedUserAiGatewayApiKey(
  userId: string
): Promise<string | null> {
  const cached = await readCachedUserAiGatewayApiKey(userId).catch(() => null)
  if (cached) {
    return cached
  }

  const [row] = await db
    .select({ aiGatewayApiKey: user.aiGatewayApiKey })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1)
  const encrypted = row?.aiGatewayApiKey ?? null
  if (encrypted) {
    await writeCachedUserAiGatewayApiKey({ encrypted, userId }).catch(
      () => undefined
    )
  }
  return encrypted
}

async function readCachedUserAiGatewayApiKey(
  userId: string
): Promise<string | null> {
  const redis = getUpstashRedis()
  if (!redis) {
    return null
  }

  return (await redis.get<string>(aiGatewayApiKeyCacheKey(userId))) ?? null
}

async function writeCachedUserAiGatewayApiKey(input: {
  encrypted: string
  userId: string
}): Promise<void> {
  const redis = getUpstashRedis()
  if (!redis) {
    return
  }

  await redis.set(aiGatewayApiKeyCacheKey(input.userId), input.encrypted)
}

async function clearCachedUserAiGatewayApiKey(userId: string): Promise<void> {
  const redis = getUpstashRedis()
  if (!redis) {
    return
  }

  await redis.del(aiGatewayApiKeyCacheKey(userId))
}

function aiGatewayApiKeyCacheKey(userId: string): string {
  return `user:${userId}:${AI_GATEWAY_API_KEY_CACHE_SUFFIX}`
}
