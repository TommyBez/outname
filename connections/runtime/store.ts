import 'server-only'

import { and, eq } from 'drizzle-orm'
import { revalidateTag } from 'next/cache'
import { encryptCredential } from '@/connections/crypto'
import { db } from '@/shared/db'
import { userConnections } from '@/shared/db/schema'
import { userConnectionsTag } from '@/shared/server/cache-tags'
import type { RawCredential, StoredCredentialBlob } from '../types'
import type {
  ConnectionStatus,
  ConnectionStatusView,
  UserConnectionView,
} from './types'

export async function persistApiKeyConnection(args: {
  connectorId: string
  userId: string
  raw: RawCredential
  metadata?: Record<string, unknown>
}): Promise<void> {
  const credentialsB64 = await encryptCredential({
    kind: 'api_key',
    values: args.raw,
  } satisfies StoredCredentialBlob)
  const metadata = args.metadata ?? {}
  const existing = await hasConnectionRow(args)
  if (existing) {
    await db
      .update(userConnections)
      .set({
        credentials: credentialsB64,
        metadata,
        grantedScopes: [],
        status: 'active',
        expiresAt: null,
        lastError: null,
        updatedAt: new Date(),
      })
      .where(connectionFilter(args))
  } else {
    await db.insert(userConnections).values({
      userId: args.userId,
      connectorId: args.connectorId,
      credentials: credentialsB64,
      metadata,
      grantedScopes: [],
      status: 'active',
      expiresAt: null,
    })
  }
  revalidateConnection(args.userId)
}

export async function disconnectConnection(args: {
  connectorId: string
  userId: string
}): Promise<void> {
  await db.delete(userConnections).where(connectionFilter(args))
  revalidateConnection(args.userId)
}

export async function markInvalid(args: {
  connectorId: string
  userId: string
  error: string
}): Promise<void> {
  await db
    .update(userConnections)
    .set({
      status: 'invalid',
      lastError: args.error,
      updatedAt: new Date(),
    })
    .where(connectionFilter(args))
  revalidateConnection(args.userId)
}

export async function getConnectionStatus(args: {
  connectorId: string
  userId: string
}): Promise<ConnectionStatusView | null> {
  const [row] = await db
    .select({
      status: userConnections.status,
      metadata: userConnections.metadata,
      grantedScopes: userConnections.grantedScopes,
      lastError: userConnections.lastError,
      expiresAt: userConnections.expiresAt,
    })
    .from(userConnections)
    .where(connectionFilter(args))
    .limit(1)
  if (!row) {
    return {
      exists: false,
      status: null,
      metadata: {},
      grantedScopes: [],
      lastError: null,
      expiresAt: null,
    }
  }
  return {
    exists: true,
    status: row.status as ConnectionStatus,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    grantedScopes: normalizeScopes(row.grantedScopes),
    lastError: row.lastError,
    expiresAt: row.expiresAt,
  }
}

export async function persistOAuth2Connection(args: {
  connectorId: string
  credentials: Extract<StoredCredentialBlob, { kind: 'oauth2' }>
  expiresAt: Date | null
  grantedScopes: readonly string[]
  metadata?: Record<string, unknown>
  userId: string
}): Promise<void> {
  const credentialsB64 = await encryptCredential(args.credentials)
  const metadata = args.metadata ?? {}
  const existing = await hasConnectionRow(args)
  if (existing) {
    await db
      .update(userConnections)
      .set({
        credentials: credentialsB64,
        metadata,
        grantedScopes: [...args.grantedScopes],
        status: 'active',
        expiresAt: args.expiresAt,
        lastError: null,
        updatedAt: new Date(),
      })
      .where(connectionFilter(args))
  } else {
    await db.insert(userConnections).values({
      userId: args.userId,
      connectorId: args.connectorId,
      credentials: credentialsB64,
      metadata,
      grantedScopes: [...args.grantedScopes],
      status: 'active',
      expiresAt: args.expiresAt,
    })
  }
  revalidateConnection(args.userId)
}

export async function updateOAuth2ConnectionTokens(args: {
  connectorId: string
  credentials: Extract<StoredCredentialBlob, { kind: 'oauth2' }>
  expiresAt: Date | null
  grantedScopes: readonly string[]
  userId: string
}): Promise<void> {
  await db
    .update(userConnections)
    .set({
      credentials: await encryptCredential(args.credentials),
      grantedScopes: [...args.grantedScopes],
      expiresAt: args.expiresAt,
      status: 'active',
      lastError: null,
      updatedAt: new Date(),
    })
    .where(connectionFilter(args))
  revalidateConnection(args.userId)
}

export async function listUserConnections(
  userId: string
): Promise<UserConnectionView[]> {
  const rows = await db
    .select({
      connectorId: userConnections.connectorId,
      status: userConnections.status,
      metadata: userConnections.metadata,
      grantedScopes: userConnections.grantedScopes,
      lastError: userConnections.lastError,
      expiresAt: userConnections.expiresAt,
      createdAt: userConnections.createdAt,
    })
    .from(userConnections)
    .where(eq(userConnections.userId, userId))
  return rows.map((row) => ({
    connectorId: row.connectorId,
    status: row.status as ConnectionStatus,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    grantedScopes: normalizeScopes(row.grantedScopes),
    lastError: row.lastError,
    expiresAt: row.expiresAt,
    createdAt: row.createdAt,
  }))
}

async function hasConnectionRow(args: {
  connectorId: string
  userId: string
}): Promise<boolean> {
  const [row] = await db
    .select({ connectorId: userConnections.connectorId })
    .from(userConnections)
    .where(connectionFilter(args))
    .limit(1)
  return Boolean(row)
}

function connectionFilter(args: { connectorId: string; userId: string }) {
  return and(
    eq(userConnections.userId, args.userId),
    eq(userConnections.connectorId, args.connectorId)
  )
}

function revalidateConnection(userId: string): void {
  revalidateTag(userConnectionsTag(userId), 'max')
}

function normalizeScopes(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }
  return value.filter((item): item is string => typeof item === 'string')
}
