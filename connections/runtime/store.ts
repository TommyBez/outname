import 'server-only'

import { and, eq } from 'drizzle-orm'
import { revalidateTag } from 'next/cache'
import { encryptCredential } from '@/connections/crypto'
import { db } from '@/shared/db'
import { userConnections } from '@/shared/db/schema'
import { userConnectionsTag } from '@/shared/server/cache-tags'
import type { RawCredential } from '../types'
import type {
  ConnectionStatus,
  ConnectionStatusView,
  UserConnectionView,
} from './types'

export async function persistApiKeyConnection(args: {
  userId: string
  provider: string
  raw: RawCredential
  metadata?: Record<string, unknown>
}): Promise<void> {
  const credentialsB64 = await encryptCredential(args.raw)
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
      .where(connectionFilter(args))
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
  revalidateConnection(args.userId)
}

export async function disconnectProvider(args: {
  userId: string
  provider: string
}): Promise<void> {
  await db.delete(userConnections).where(connectionFilter(args))
  revalidateConnection(args.userId)
}

export async function markInvalid(args: {
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
    .where(connectionFilter(args))
  revalidateConnection(args.userId)
}

export async function getConnectionStatus(args: {
  userId: string
  provider: string
}): Promise<ConnectionStatusView | null> {
  const [row] = await db
    .select({
      status: userConnections.status,
      metadata: userConnections.metadata,
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

export async function listUserConnections(
  userId: string
): Promise<UserConnectionView[]> {
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
  return rows.map((row) => ({
    provider: row.provider,
    status: row.status as ConnectionStatus,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    lastError: row.lastError,
    expiresAt: row.expiresAt,
    createdAt: row.createdAt,
  }))
}

async function hasConnectionRow(args: {
  userId: string
  provider: string
}): Promise<boolean> {
  const [row] = await db
    .select({ provider: userConnections.provider })
    .from(userConnections)
    .where(connectionFilter(args))
    .limit(1)
  return Boolean(row)
}

function connectionFilter(args: { userId: string; provider: string }) {
  return and(
    eq(userConnections.userId, args.userId),
    eq(userConnections.provider, args.provider)
  )
}

function revalidateConnection(userId: string): void {
  revalidateTag(userConnectionsTag(userId), 'max')
}
