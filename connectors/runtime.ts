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

interface ConnectionRowData {
  lastError: string | null
  metadata: Record<string, unknown>
  raw: RawCredential | null
  status: ConnectionStatus
}

async function readConnectionRow(
  userId: string,
  provider: string
): Promise<ConnectionRowData | null> {
  const [row] = await db
    .select()
    .from(userConnections)
    .where(
      and(
        eq(userConnections.userId, userId),
        eq(userConnections.provider, provider)
      )
    )
    .limit(1)
  if (!row) {
    return null
  }
  let raw: RawCredential
  try {
    raw = decryptCredential(row.credentials)
  } catch (err) {
    // Tampering / key mismatch / corruption: mark invalid so the user
    // can replace the key instead of getting a 500.
    console.error('[v0] decryptCredential failed', {
      provider,
      userId,
      err,
    })
    const message =
      err instanceof Error
        ? err.message
        : 'Stored credential could not decrypt.'
    await markInvalid({ userId, provider, error: message })
    return {
      raw: null,
      metadata: (row.metadata as Record<string, unknown>) ?? {},
      status: 'invalid',
      lastError: message,
    }
  }
  return {
    raw,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    status: row.status as ConnectionStatus,
    lastError: row.lastError,
  }
}

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

export interface ResolveCredentialsResult {
  /** Map of provider id -> decrypted credential. */
  ready: Map<string, RawCredential>
  /** One row per (provider, toolId) pair that couldn't be satisfied. */
  reconnects: Reconnect[]
}

/**
 * Resolve the credential bundle for a session event.
 *
 * Buckets requirements by provider so we read and decrypt each API key
 * once per event. Failures produce reconnect entries and never throw
 * out of this function.
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
  ready: Map<string, RawCredential>
  reconnects: Reconnect[]
}): Promise<void> {
  const { userId, provider, bucket, ready, reconnects } = args
  const connector = getConnector(provider)
  if (!connector) {
    fanOutReconnect(reconnects, provider, bucket.toolIds)
    return
  }

  const row = await readConnectionRow(userId, provider)
  if (!row) {
    fanOutReconnect(reconnects, provider, bucket.toolIds)
    return
  }

  if (row.status === 'invalid' || row.raw === null) {
    fanOutReconnect(reconnects, provider, bucket.toolIds)
    return
  }

  ready.set(provider, row.raw)
}

export async function resolveCredentials(args: {
  userId: string
  requirements: ProviderRequirement[]
}): Promise<ResolveCredentialsResult> {
  const ready = new Map<string, RawCredential>()
  const reconnects: Reconnect[] = []
  const byProvider = bucketRequirementsByProvider(args.requirements)

  for (const [provider, bucket] of byProvider) {
    await resolveOneProvider({
      userId: args.userId,
      provider,
      bucket,
      ready,
      reconnects,
    })
  }

  return { ready, reconnects }
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
