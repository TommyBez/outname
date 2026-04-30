import 'server-only'
import { and, eq } from 'drizzle-orm'
import { revalidateTag } from 'next/cache'
import {
  decryptCredential,
  encryptCredential,
} from '@/lib/connection-crypto'
import { db } from '@/lib/db'
import { userConnections } from '@/lib/db/schema'
import { userConnectionsTag } from '@/lib/cache-tags'
import type { Reconnect } from '@/tools/types'
import { getConnector } from './registry'
import type { OAuthExchangeResult, RawCredential } from './types'

/**
 * Status lifecycle for `user_connections.status` — owned exclusively by
 * this module:
 *
 *     active   ←  exchangeCode succeeds
 *     active   ←  refresh succeeds
 *     expired  ←  refresh returns 401 / invalid_token
 *     revoked  ←  refresh returns invalid_grant: revoked OR explicit
 *                 disconnect call
 *
 * Reads fan out via `userConnectionsTag(userId)` so the catalog UI and
 * `/settings` revalidate as soon as anything in here writes.
 */

interface ConnectionRowData {
  raw: RawCredential
  metadata: Record<string, unknown>
  expiresAt: Date | null
  status: 'active' | 'expired' | 'revoked'
  lastError: string | null
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
    // Tampering / key mismatch / corruption: treat as expired so the
    // user is prompted to reconnect rather than thrown back to a 500.
    console.error('[v0] decryptCredential failed', {
      provider,
      userId,
      err,
    })
    return null
  }
  return {
    raw,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    expiresAt: row.expiresAt,
    status: row.status as ConnectionRowData['status'],
    lastError: row.lastError,
  }
}

async function persistOAuthExchangeResult(args: {
  userId: string
  provider: string
  result: OAuthExchangeResult
  /** When true, merge metadata; when false (default), replace. */
  mergeMetadata?: boolean
}): Promise<void> {
  const { userId, provider, result, mergeMetadata = false } = args
  const credentialsB64 = encryptCredential(result.raw)
  const expiresAt = result.expiresAt ? new Date(result.expiresAt) : null

  // Build the metadata payload. We always store the granted scope set
  // — that's what scope-gap detection consults.
  const newMetadata = {
    ...result.metadata,
    scopes: result.grantedScopes,
  }

  // Upsert. We can't use ON CONFLICT cleanly across the neon-http
  // driver without sneaking an SQL string, so do a read-then-write.
  const existing = await readConnectionRow(userId, provider)
  if (existing) {
    const merged = mergeMetadata
      ? { ...existing.metadata, ...newMetadata }
      : newMetadata
    await db
      .update(userConnections)
      .set({
        credentials: credentialsB64,
        metadata: merged,
        status: 'active',
        expiresAt,
        lastError: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(userConnections.userId, userId),
          eq(userConnections.provider, provider)
        )
      )
  } else {
    await db.insert(userConnections).values({
      userId,
      provider,
      credentials: credentialsB64,
      metadata: newMetadata,
      status: 'active',
      expiresAt,
      lastError: null,
    })
  }
  revalidateTag(userConnectionsTag(userId), 'max')
}

export async function persistOAuthExchange(args: {
  userId: string
  provider: string
  result: OAuthExchangeResult
}): Promise<void> {
  return persistOAuthExchangeResult(args)
}

export async function persistApiKeyConnection(args: {
  userId: string
  provider: string
  raw: RawCredential
  metadata?: Record<string, unknown>
}): Promise<void> {
  const credentialsB64 = encryptCredential(args.raw)
  const metadata = { ...(args.metadata ?? {}), scopes: [] as string[] }
  const existing = await readConnectionRow(args.userId, args.provider)
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

async function markStatus(args: {
  userId: string
  provider: string
  status: 'expired' | 'revoked'
  error: string
}): Promise<void> {
  await db
    .update(userConnections)
    .set({
      status: args.status,
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
 * Tear a connection down: best-effort revoke at the provider, then
 * delete the row locally.
 */
export async function disconnectProvider(args: {
  userId: string
  provider: string
}): Promise<void> {
  const existing = await readConnectionRow(args.userId, args.provider)
  if (existing) {
    const connector = getConnector(args.provider)
    if (connector?.kind === 'oauth' && connector.oauth.revoke) {
      try {
        await connector.oauth.revoke(existing.raw)
      } catch (err) {
        console.error('[v0] disconnectProvider: revoke failed', err)
      }
    }
  }
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

/**
 * Decide whether an access token is "near expiry" and worth refreshing
 * before handing it to a tool. We keep a 60-second cushion so a slow
 * provider call doesn't 401 mid-flight.
 */
function nearExpiry(expiresAt: Date | null): boolean {
  if (!expiresAt) {
    return false
  }
  return expiresAt.getTime() - Date.now() < 60_000
}

function classifyRefreshError(
  err: unknown
): 'expired' | 'revoked' {
  // Google + most providers send 400 with body containing
  // `invalid_grant` for revoked or expired refresh tokens. We treat
  // both as "user needs to reconnect"; the only difference between
  // expired vs revoked here is which copy we surface to the model.
  const message = err instanceof Error ? err.message : String(err)
  if (/invalid_grant.*(revoked|consent)/i.test(message)) {
    return 'revoked'
  }
  return 'expired'
}

export interface ProviderRequirement {
  provider: string
  /** Provider-defined scope strings; OAuth only. */
  scopes?: string[]
  /** Tool id that asked for this — used to attribute reconnect rows. */
  toolId: string
}

export interface ResolveCredentialsResult {
  /** Map of provider id -> decrypted, refreshed credential. */
  ready: Map<string, RawCredential>
  /** One row per (provider, toolId) pair that couldn't be satisfied. */
  reconnects: Reconnect[]
}

/**
 * Resolve the credential bundle for a session event.
 *
 * - Buckets requirements by provider so we read each row and refresh
 *   each token at most once per event.
 * - Refresh failures flip `status` and produce a reconnect entry per
 *   tool that asked for this provider; they NEVER throw out of this
 *   function.
 * - Scope-gap math is generic set-difference on `metadata.scopes`.
 */
export async function resolveCredentials(args: {
  userId: string
  requirements: ProviderRequirement[]
}): Promise<ResolveCredentialsResult> {
  const ready = new Map<string, RawCredential>()
  const reconnects: Reconnect[] = []

  // Bucket requirements by provider, unioning scope sets.
  const byProvider = new Map<string, { scopes: Set<string>; toolIds: Set<string> }>()
  for (const req of args.requirements) {
    let bucket = byProvider.get(req.provider)
    if (!bucket) {
      bucket = { scopes: new Set(), toolIds: new Set() }
      byProvider.set(req.provider, bucket)
    }
    for (const s of req.scopes ?? []) {
      bucket.scopes.add(s)
    }
    bucket.toolIds.add(req.toolId)
  }

  for (const [provider, bucket] of byProvider) {
    const connector = getConnector(provider)
    if (!connector) {
      // Unknown provider in registry — surface as missing for every
      // tool that wanted it. Catalog UI will offer Detach.
      for (const toolId of bucket.toolIds) {
        reconnects.push({ provider, toolId, reason: 'missing_credential' })
      }
      continue
    }

    const row = await readConnectionRow(args.userId, provider)
    if (!row) {
      for (const toolId of bucket.toolIds) {
        reconnects.push({ provider, toolId, reason: 'missing_credential' })
      }
      continue
    }

    if (row.status === 'revoked') {
      for (const toolId of bucket.toolIds) {
        reconnects.push({ provider, toolId, reason: 'revoked' })
      }
      continue
    }
    if (row.status === 'expired') {
      for (const toolId of bucket.toolIds) {
        reconnects.push({ provider, toolId, reason: 'expired' })
      }
      continue
    }

    let credential = row.raw
    let grantedScopes = (row.metadata.scopes as string[] | undefined) ?? []

    if (connector.kind === 'oauth' && nearExpiry(row.expiresAt)) {
      try {
        const next = await connector.oauth.refresh(row.raw)
        await persistOAuthExchangeResult({
          userId: args.userId,
          provider,
          result: next,
          // Refreshes return an empty metadata object; merge so we
          // keep `email`, `accountId`, etc. from the original exchange.
          mergeMetadata: true,
        })
        credential = next.raw
        // Refresh responses sometimes omit the scope claim entirely;
        // fall back to whatever we already had.
        grantedScopes =
          next.grantedScopes.length > 0 ? next.grantedScopes : grantedScopes
      } catch (err) {
        const reason = classifyRefreshError(err)
        await markStatus({
          userId: args.userId,
          provider,
          status: reason,
          error: err instanceof Error ? err.message : String(err),
        })
        for (const toolId of bucket.toolIds) {
          reconnects.push({ provider, toolId, reason })
        }
        continue
      }
    }

    // Scope-gap math (generic; OAuth only — api_key bucket.scopes is
    // empty by construction, so the gap is trivially empty).
    if (bucket.scopes.size > 0) {
      const granted = new Set(grantedScopes)
      const gap: string[] = []
      for (const s of bucket.scopes) {
        if (!granted.has(s)) {
          gap.push(s)
        }
      }
      if (gap.length > 0) {
        for (const toolId of bucket.toolIds) {
          reconnects.push({
            provider,
            toolId,
            reason: 'scope_gap',
            neededScopes: gap,
          })
        }
        continue
      }
    }

    ready.set(provider, credential)
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
  status: 'active' | 'expired' | 'revoked' | null
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
    return { exists: false, status: null, metadata: {}, lastError: null, expiresAt: null }
  }
  return {
    exists: true,
    status: row.status as 'active' | 'expired' | 'revoked',
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
    status: 'active' | 'expired' | 'revoked'
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
    status: r.status as 'active' | 'expired' | 'revoked',
    metadata: (r.metadata as Record<string, unknown>) ?? {},
    lastError: r.lastError,
    expiresAt: r.expiresAt,
    createdAt: r.createdAt,
  }))
}

