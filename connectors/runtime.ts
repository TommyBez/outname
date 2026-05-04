import 'server-only'
import { and, eq } from 'drizzle-orm'
import { revalidateTag } from 'next/cache'
import { userConnectionsTag } from '@/lib/cache-tags'
import { decryptCredential, encryptCredential } from '@/lib/connection-crypto'
import { db } from '@/lib/db'
import { userConnections } from '@/lib/db/schema'
import type { Reconnect } from '@/tools/types'
import { getConnector } from './registry'
import type { RawCredential } from './types'

/**
 * Status lifecycle for `user_connections.status` — owned exclusively by
 * this module:
 *
 *     active   ←  API key validates and saves
 *     invalid  ←  stored credential cannot be decrypted
 *
 * Reads fan out via `userConnectionsTag(userId)` so the catalog UI and
 * `/settings` revalidate as soon as anything in here writes.
 */

type ConnectionStatus = 'active' | 'invalid'

async function hasConnectionRow(args: {
  userId: string
  provider: string
}): Promise<boolean> {
  const [row] = await db
    .select({ provider: userConnections.provider })
    .from(userConnections)
    .where(
      and(
        eq(userConnections.userId, args.userId),
        eq(userConnections.provider, args.provider)
      )
    )
    .limit(1)
  return Boolean(row)
}

export async function persistApiKeyConnection(args: {
  userId: string
  provider: string
  raw: RawCredential
  metadata?: Record<string, unknown>
}): Promise<void> {
  const credentialsB64 = encryptCredential(args.raw)
  const metadata = args.metadata ?? {}
  const existing = await hasConnectionRow(args)
  if (existing) {
    await db
      .update(userConnections)
      .set({
        credentials: credentialsB64,
        metadata,
        status: 'active',
        expiresAt: null,
        lastError: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(userConnections.userId, args.userId),
          eq(userConnections.provider, args.provider)
        )
      )
  } else {
    await db.insert(userConnections).values({
      userId: args.userId,
      provider: args.provider,
      credentials: credentialsB64,
      metadata,
      status: 'active',
      expiresAt: null,
    })
  }
  revalidateTag(userConnectionsTag(args.userId), 'max')
}

async function markInvalid(args: {
  userId: string
  provider: string
  error: string
}): Promise<void> {
  await db
    .update(userConnections)
    .set({
      status: 'invalid',
      lastError: args.error,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(userConnections.userId, args.userId),
        eq(userConnections.provider, args.provider)
      )
    )
  revalidateTag(userConnectionsTag(args.userId), 'max')
}

/**
 * Tear a connection down by deleting the locally stored API key.
 */
export async function disconnectProvider(args: {
  userId: string
  provider: string
}): Promise<void> {
  await db
    .delete(userConnections)
    .where(
      and(
        eq(userConnections.userId, args.userId),
        eq(userConnections.provider, args.provider)
      )
    )
  revalidateTag(userConnectionsTag(args.userId), 'max')
}

export interface ProviderRequirement {
  provider: string
  /** Tool id that asked for this — used to attribute reconnect rows. */
  toolId: string
}

export interface ResolveConnectionAvailabilityResult {
  /** Providers whose stored credentials decrypted and parsed. No secret bytes. */
  readyProviders: Set<string>
  /** One row per (provider, toolId) pair that couldn't be satisfied. */
  reconnects: Reconnect[]
}

/**
 * Resolve connection availability for a session event.
 *
 * Buckets requirements by provider so we validate each connection once
 * per event. This decrypts through the same broker credential path used
 * at execute time, but the credential bytes are discarded immediately:
 * only provider readiness crosses the workflow boundary.
 */
interface ProviderBucket {
  toolIds: Set<string>
}

function bucketRequirementsByProvider(
  requirements: ProviderRequirement[]
): Map<string, ProviderBucket> {
  const byProvider = new Map<string, ProviderBucket>()
  for (const req of requirements) {
    let bucket = byProvider.get(req.provider)
    if (!bucket) {
      bucket = { toolIds: new Set() }
      byProvider.set(req.provider, bucket)
    }
    bucket.toolIds.add(req.toolId)
  }
  return byProvider
}

function fanOutReconnect(
  reconnects: Reconnect[],
  provider: string,
  toolIds: Iterable<string>
): void {
  for (const toolId of toolIds) {
    reconnects.push({ provider, toolId, reason: 'connection_unavailable' })
  }
}

async function resolveOneProvider(args: {
  userId: string
  provider: string
  bucket: ProviderBucket
  readyProviders: Set<string>
  reconnects: Reconnect[]
}): Promise<void> {
  const { userId, provider, bucket, readyProviders, reconnects } = args
  const connector = getConnector(provider)
  if (!connector) {
    fanOutReconnect(reconnects, provider, bucket.toolIds)
    return
  }

  try {
    await readBrokeredCredential({ userId, provider })
  } catch (err) {
    if (!(err instanceof BrokerCredentialUnavailableError)) {
      throw err
    }
    fanOutReconnect(reconnects, provider, bucket.toolIds)
    return
  }

  readyProviders.add(provider)
}

export async function resolveConnectionAvailability(args: {
  userId: string
  requirements: ProviderRequirement[]
}): Promise<ResolveConnectionAvailabilityResult> {
  const readyProviders = new Set<string>()
  const reconnects: Reconnect[] = []
  const byProvider = bucketRequirementsByProvider(args.requirements)

  await Promise.all(
    Array.from(byProvider.entries()).map(([provider, bucket]) =>
      resolveOneProvider({
        userId: args.userId,
        provider,
        bucket,
        readyProviders,
        reconnects,
      })
    )
  )

  return { readyProviders, reconnects }
}

export class BrokerCredentialUnavailableError extends Error {
  readonly code = 'connection_unavailable' as const
  readonly provider: string

  constructor(provider: string, message: string) {
    super(message)
    this.provider = provider
    this.name = 'BrokerCredentialUnavailableError'
  }
}

/**
 * Decrypt and validate one provider credential for brokered HTTP.
 * This is the only runtime path that turns encrypted connection bytes
 * into a provider-specific credential object.
 */
export async function readBrokeredCredential(args: {
  provider: string
  userId: string
}): Promise<RawCredential> {
  const connector = getConnector(args.provider)
  if (!connector) {
    throw new BrokerCredentialUnavailableError(
      args.provider,
      `Unknown provider: ${args.provider}`
    )
  }

  const [row] = await db
    .select({
      credentials: userConnections.credentials,
      status: userConnections.status,
    })
    .from(userConnections)
    .where(
      and(
        eq(userConnections.userId, args.userId),
        eq(userConnections.provider, args.provider)
      )
    )
    .limit(1)

  if (!row || row.status === 'invalid') {
    throw new BrokerCredentialUnavailableError(
      args.provider,
      `Connection for ${args.provider} is missing or invalid.`
    )
  }

  let raw: RawCredential
  try {
    raw = decryptCredential(row.credentials)
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : 'Stored credential could not decrypt.'
    await markInvalid({
      userId: args.userId,
      provider: args.provider,
      error: message,
    })
    throw new BrokerCredentialUnavailableError(args.provider, message)
  }

  const parsed = connector.apiKey.formSchema.safeParse(raw)
  if (!parsed.success) {
    const message =
      parsed.error.issues[0]?.message ?? 'Stored credential shape is invalid.'
    await markInvalid({
      userId: args.userId,
      provider: args.provider,
      error: message,
    })
    throw new BrokerCredentialUnavailableError(args.provider, message)
  }

  return parsed.data
}

/**
 * Read a single connection for the catalog / settings UI. Skips
 * decryption — UI never needs the raw credential, only status +
 * metadata.
 */
export async function getConnectionStatus(args: {
  userId: string
  provider: string
}): Promise<{
  exists: boolean
  status: ConnectionStatus | null
  metadata: Record<string, unknown>
  lastError: string | null
  expiresAt: Date | null
} | null> {
  const [row] = await db
    .select({
      status: userConnections.status,
      metadata: userConnections.metadata,
      lastError: userConnections.lastError,
      expiresAt: userConnections.expiresAt,
    })
    .from(userConnections)
    .where(
      and(
        eq(userConnections.userId, args.userId),
        eq(userConnections.provider, args.provider)
      )
    )
    .limit(1)
  if (!row) {
    return {
      exists: false,
      status: null,
      metadata: {},
      lastError: null,
      expiresAt: null,
    }
  }
  return {
    exists: true,
    status: row.status as ConnectionStatus,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    lastError: row.lastError,
    expiresAt: row.expiresAt,
  }
}

/**
 * List every provider the user currently has stored (status + metadata
 * only). Drives the `/settings` connections list.
 */
export async function listUserConnections(userId: string): Promise<
  Array<{
    provider: string
    status: ConnectionStatus
    metadata: Record<string, unknown>
    lastError: string | null
    expiresAt: Date | null
    createdAt: Date
  }>
> {
  const rows = await db
    .select({
      provider: userConnections.provider,
      status: userConnections.status,
      metadata: userConnections.metadata,
      lastError: userConnections.lastError,
      expiresAt: userConnections.expiresAt,
      createdAt: userConnections.createdAt,
    })
    .from(userConnections)
    .where(eq(userConnections.userId, userId))
  return rows.map((r) => ({
    provider: r.provider,
    status: r.status as ConnectionStatus,
    metadata: (r.metadata as Record<string, unknown>) ?? {},
    lastError: r.lastError,
    expiresAt: r.expiresAt,
    createdAt: r.createdAt,
  }))
}
