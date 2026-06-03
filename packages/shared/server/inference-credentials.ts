import 'server-only'

import { db } from '@outname/db'
import {
  type InferenceProvider,
  inferenceProviderValues,
  user,
  userInferenceCredentials,
} from '@outname/db/schema'
import {
  decryptCredential,
  encryptCredential,
} from '@outname/shared/connections/crypto'
import { getUpstashRedis } from '@outname/shared/server/upstash-redis'
import { and, eq } from 'drizzle-orm'
import {
  InferenceCredentialVerificationError,
  MissingInferenceCredentialError,
} from './inference-provider-errors'
import { DEFAULT_INFERENCE_PROVIDER } from './inference-provider-registry'
import { verifyInferenceCredential } from './inference-provider-verify'

const INFERENCE_CREDENTIAL_CACHE_SUFFIX = 'inference-credential'

export interface UserInferenceProviderState {
  enabled: boolean
  inferenceProvider: InferenceProvider
  isDefault: boolean
  lastError: string | null
  status: 'enabled' | 'invalid' | null
  verifiedAt: Date | null
}

export async function listUserInferenceProviderStates(
  userId: string
): Promise<UserInferenceProviderState[]> {
  const [defaultProvider, rows] = await Promise.all([
    getDefaultInferenceProvider(userId),
    db
      .select({
        inferenceProvider: userInferenceCredentials.inferenceProvider,
        lastError: userInferenceCredentials.lastError,
        status: userInferenceCredentials.status,
        verifiedAt: userInferenceCredentials.verifiedAt,
      })
      .from(userInferenceCredentials)
      .where(eq(userInferenceCredentials.userId, userId)),
  ])
  const byProvider = new Map(rows.map((row) => [row.inferenceProvider, row]))

  return inferenceProviderValues.map((inferenceProvider) => {
    const row = byProvider.get(inferenceProvider) ?? null
    return {
      enabled: row?.status === 'enabled',
      inferenceProvider,
      isDefault: defaultProvider === inferenceProvider,
      lastError: row?.lastError ?? null,
      status: row?.status ?? null,
      verifiedAt: row?.verifiedAt ?? null,
    }
  })
}

export async function setUserInferenceCredential(input: {
  apiKey: string
  inferenceProvider: InferenceProvider
  userId: string
}): Promise<void> {
  const apiKey = input.apiKey.trim()
  if (!apiKey) {
    throw new InferenceCredentialVerificationError(
      input.inferenceProvider,
      'API key is required.'
    )
  }

  const metadata = await verifyInferenceCredential({
    apiKey,
    inferenceProvider: input.inferenceProvider,
  })
  const encrypted = await encryptCredential({ apiKey })
  const now = new Date()

  await db
    .insert(userInferenceCredentials)
    .values({
      userId: input.userId,
      inferenceProvider: input.inferenceProvider,
      encryptedCredentials: encrypted,
      status: 'enabled',
      verifiedAt: now,
      lastError: null,
      metadata,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [
        userInferenceCredentials.userId,
        userInferenceCredentials.inferenceProvider,
      ],
      set: {
        encryptedCredentials: encrypted,
        status: 'enabled',
        verifiedAt: now,
        lastError: null,
        metadata,
        updatedAt: now,
      },
    })

  await writeCachedEncryptedInferenceCredential({
    encrypted,
    inferenceProvider: input.inferenceProvider,
    userId: input.userId,
  }).catch(() => undefined)

  await ensureDefaultInferenceProvider({
    inferenceProvider: input.inferenceProvider,
    userId: input.userId,
  })
}

export async function clearUserInferenceCredential(input: {
  inferenceProvider: InferenceProvider
  userId: string
}): Promise<void> {
  await db
    .delete(userInferenceCredentials)
    .where(
      and(
        eq(userInferenceCredentials.userId, input.userId),
        eq(userInferenceCredentials.inferenceProvider, input.inferenceProvider)
      )
    )

  await clearCachedEncryptedInferenceCredential(input).catch(() => undefined)

  const [row] = await db
    .select({ defaultInferenceProvider: user.defaultInferenceProvider })
    .from(user)
    .where(eq(user.id, input.userId))
    .limit(1)
  if (row?.defaultInferenceProvider === input.inferenceProvider) {
    const remaining = await listEnabledInferenceProviders(input.userId)
    const replacement = remaining.length === 1 ? remaining[0] : null
    await db
      .update(user)
      .set({ defaultInferenceProvider: replacement ?? null })
      .where(eq(user.id, input.userId))
  }
}

export async function hasEnabledInferenceProvider(input: {
  inferenceProvider: InferenceProvider
  userId: string
}): Promise<boolean> {
  const [row] = await db
    .select({ status: userInferenceCredentials.status })
    .from(userInferenceCredentials)
    .where(
      and(
        eq(userInferenceCredentials.userId, input.userId),
        eq(userInferenceCredentials.inferenceProvider, input.inferenceProvider)
      )
    )
    .limit(1)
  return row?.status === 'enabled'
}

export async function listEnabledInferenceProviders(
  userId: string
): Promise<InferenceProvider[]> {
  const rows = await db
    .select({ inferenceProvider: userInferenceCredentials.inferenceProvider })
    .from(userInferenceCredentials)
    .where(
      and(
        eq(userInferenceCredentials.userId, userId),
        eq(userInferenceCredentials.status, 'enabled')
      )
    )
  return rows.map((row) => row.inferenceProvider)
}

export async function getDefaultInferenceProvider(
  userId: string
): Promise<InferenceProvider | null> {
  const [row] = await db
    .select({ defaultInferenceProvider: user.defaultInferenceProvider })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1)
  return row?.defaultInferenceProvider ?? null
}

export async function setDefaultInferenceProvider(input: {
  inferenceProvider: InferenceProvider
  userId: string
}): Promise<void> {
  if (!(await hasEnabledInferenceProvider(input))) {
    throw new MissingInferenceCredentialError(input.inferenceProvider)
  }
  await db
    .update(user)
    .set({ defaultInferenceProvider: input.inferenceProvider })
    .where(eq(user.id, input.userId))
}

export async function getRequiredDefaultInferenceProvider(
  userId: string
): Promise<InferenceProvider> {
  const selected = await getDefaultInferenceProvider(userId)
  if (
    selected &&
    (await hasEnabledInferenceProvider({ userId, inferenceProvider: selected }))
  ) {
    return selected
  }

  const enabled = await listEnabledInferenceProviders(userId)
  if (enabled.length === 1 && enabled[0]) {
    return enabled[0]
  }
  throw new MissingInferenceCredentialError(
    selected ?? DEFAULT_INFERENCE_PROVIDER
  )
}

export async function readUserInferenceCredentialApiKey(input: {
  inferenceProvider: InferenceProvider
  userId: string
}): Promise<string> {
  const encrypted = await readEncryptedUserInferenceCredential(input)
  const decrypted = await decryptCredential<{ apiKey?: string }>(encrypted)
  const apiKey = decrypted.apiKey?.trim()
  if (!apiKey) {
    throw new MissingInferenceCredentialError(input.inferenceProvider)
  }
  return apiKey
}

async function readEncryptedUserInferenceCredential(input: {
  inferenceProvider: InferenceProvider
  userId: string
}): Promise<string> {
  const cached = await readCachedEncryptedInferenceCredential(input).catch(
    () => null
  )
  if (cached) {
    return cached
  }

  const [row] = await db
    .select({
      encryptedCredentials: userInferenceCredentials.encryptedCredentials,
      status: userInferenceCredentials.status,
    })
    .from(userInferenceCredentials)
    .where(
      and(
        eq(userInferenceCredentials.userId, input.userId),
        eq(userInferenceCredentials.inferenceProvider, input.inferenceProvider)
      )
    )
    .limit(1)
  if (!row || row.status !== 'enabled') {
    throw new MissingInferenceCredentialError(input.inferenceProvider)
  }

  await writeCachedEncryptedInferenceCredential({
    encrypted: row.encryptedCredentials,
    inferenceProvider: input.inferenceProvider,
    userId: input.userId,
  }).catch(() => undefined)

  return row.encryptedCredentials
}

async function readCachedEncryptedInferenceCredential(input: {
  inferenceProvider: InferenceProvider
  userId: string
}): Promise<string | null> {
  const redis = getUpstashRedis()
  if (!redis) {
    return null
  }

  return (await redis.get<string>(inferenceCredentialCacheKey(input))) ?? null
}

async function writeCachedEncryptedInferenceCredential(input: {
  encrypted: string
  inferenceProvider: InferenceProvider
  userId: string
}): Promise<void> {
  const redis = getUpstashRedis()
  if (!redis) {
    return
  }

  await redis.set(inferenceCredentialCacheKey(input), input.encrypted)
}

async function clearCachedEncryptedInferenceCredential(input: {
  inferenceProvider: InferenceProvider
  userId: string
}): Promise<void> {
  const redis = getUpstashRedis()
  if (!redis) {
    return
  }

  await redis.del(inferenceCredentialCacheKey(input))
}

function inferenceCredentialCacheKey(input: {
  inferenceProvider: InferenceProvider
  userId: string
}): string {
  return `user:${input.userId}:provider:${input.inferenceProvider}:${INFERENCE_CREDENTIAL_CACHE_SUFFIX}`
}

async function ensureDefaultInferenceProvider(input: {
  inferenceProvider: InferenceProvider
  userId: string
}): Promise<void> {
  const [row] = await db
    .select({ defaultInferenceProvider: user.defaultInferenceProvider })
    .from(user)
    .where(eq(user.id, input.userId))
    .limit(1)
  if (row?.defaultInferenceProvider) {
    return
  }
  await db
    .update(user)
    .set({ defaultInferenceProvider: input.inferenceProvider })
    .where(eq(user.id, input.userId))
}
