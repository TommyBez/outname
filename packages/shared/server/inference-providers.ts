import 'server-only'

import { createOpenRouter } from '@openrouter/ai-sdk-provider'
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
import { createGateway } from 'ai'
import { and, eq } from 'drizzle-orm'

export type { InferenceProvider } from '@outname/db/schema'

export const DEFAULT_INFERENCE_PROVIDER: InferenceProvider = 'vercel-ai-gateway'

const AI_GATEWAY_CREDITS_URL = 'https://ai-gateway.vercel.sh/v1/credits'
const OPENROUTER_KEY_URL = 'https://openrouter.ai/api/v1/key'

const OPENROUTER_EXTRA_BODY = {
  provider: {
    allow_fallbacks: false,
    require_parameters: true,
  },
} as const

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

export function isInferenceProvider(value: string): value is InferenceProvider {
  return inferenceProviderValues.includes(value as InferenceProvider)
}

export function displayInferenceProvider(provider: InferenceProvider): string {
  return provider === 'openrouter' ? 'OpenRouter' : 'Vercel AI Gateway'
}

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

export async function getUserLanguageModel(input: {
  inferenceProvider: InferenceProvider
  modelId: string
  userId: string
}) {
  const apiKey = await readUserInferenceCredentialApiKey({
    inferenceProvider: input.inferenceProvider,
    userId: input.userId,
  })

  if (input.inferenceProvider === 'openrouter') {
    const openrouter = createOpenRouter({
      apiKey,
      appName: 'OUTNA.ME',
      compatibility: 'strict',
      extraBody: OPENROUTER_EXTRA_BODY,
    })
    return openrouter(input.modelId)
  }

  const gateway = createGateway({ apiKey })
  return gateway(input.modelId)
}

async function readUserInferenceCredentialApiKey(input: {
  inferenceProvider: InferenceProvider
  userId: string
}): Promise<string> {
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

  const decrypted = await decryptCredential<{ apiKey?: string }>(
    row.encryptedCredentials
  )
  const apiKey = decrypted.apiKey?.trim()
  if (!apiKey) {
    throw new MissingInferenceCredentialError(input.inferenceProvider)
  }
  return apiKey
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

async function verifyInferenceCredential(input: {
  apiKey: string
  inferenceProvider: InferenceProvider
}): Promise<Record<string, unknown>> {
  const url =
    input.inferenceProvider === 'openrouter'
      ? OPENROUTER_KEY_URL
      : AI_GATEWAY_CREDITS_URL
  let response: Response
  try {
    response = await fetch(url, {
      headers: {
        authorization: `Bearer ${input.apiKey}`,
      },
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
    verification: summarizeVerificationBody(input.inferenceProvider, body),
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

function summarizeVerificationBody(
  provider: InferenceProvider,
  body: unknown
): Record<string, unknown> {
  if (!body || typeof body !== 'object') {
    return {}
  }
  const value = body as Record<string, unknown>
  if (provider === 'openrouter') {
    return {
      label: value.label,
      limit: value.limit,
      usage: value.usage,
      isFreeTier: value.is_free_tier,
    }
  }
  return {
    balance: value.balance,
    totalUsed: value.total_used,
  }
}
