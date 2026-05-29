import 'server-only'

import { db } from '@outname/db'
import { userConnections } from '@outname/db/schema'
import { encryptCredential } from '@outname/shared/connections/crypto'
import { userConnectionsTag } from '@outname/shared/server/cache-tags'
import { eq } from 'drizzle-orm'
import { revalidateTag } from 'next/cache'
import type { RawCredential, StoredCredentialBlob } from '../types'
import { connectionFilter } from './connection-query'
import { normalizeScopes } from './scopes'
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
  await upsertConnection({
    ...args,
    credentials: {
      kind: 'api_key',
      values: args.raw,
    },
    expiresAt: null,
    grantedScopes: [],
  })
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
  await upsertConnection(args)
}

async function upsertConnection(args: {
  connectorId: string
  credentials: StoredCredentialBlob
  expiresAt?: Date | null
  grantedScopes?: readonly string[]
  metadata?: Record<string, unknown>
  userId: string
}): Promise<void> {
  const credentialsB64 = await encryptCredential(args.credentials)
  const expiresAt = args.expiresAt ?? null
  const grantedScopes = [...(args.grantedScopes ?? [])]
  const metadata = args.metadata ?? {}
  await db
    .insert(userConnections)
    .values({
      userId: args.userId,
      connectorId: args.connectorId,
      credentials: credentialsB64,
      metadata,
      grantedScopes,
      status: 'active',
      expiresAt,
    })
    .onConflictDoUpdate({
      target: [userConnections.userId, userConnections.connectorId],
      set: {
        credentials: credentialsB64,
        metadata,
        grantedScopes,
        status: 'active',
        expiresAt,
        lastError: null,
        updatedAt: new Date(),
      },
    })
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

function revalidateConnection(userId: string): void {
  revalidateTag(userConnectionsTag(userId), 'max')
}
