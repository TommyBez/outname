import 'server-only'

import { and, eq, isNull, lt, or } from 'drizzle-orm'
import { db } from '@/shared/db'
import { agent } from '@/shared/db/schema'

const DEFAULT_SESSION_CONTROL_LEASE_TTL_MS = 60_000

export interface SessionControlLease {
  agentId: string
  leaseId: string
}

export class SessionControlLeaseBusyError extends Error {
  constructor(agentId: string) {
    super(`Session control lease is already held for agent ${agentId}.`)
    this.name = 'SessionControlLeaseBusyError'
  }
}

export function readSessionControlLeaseTtlMs(): number {
  return readNonNegativeIntegerEnv(
    process.env.SESSION_CONTROL_LEASE_TTL_MS,
    DEFAULT_SESSION_CONTROL_LEASE_TTL_MS
  )
}

export async function acquireSessionControlLease(
  agentId: string,
  ttlMs: number = readSessionControlLeaseTtlMs()
): Promise<SessionControlLease | null> {
  const now = new Date()
  const leaseId = crypto.randomUUID()
  const leaseUntil = new Date(now.getTime() + ttlMs)

  const rows = await db
    .update(agent)
    .set({
      sessionControlLeaseId: leaseId,
      sessionControlLeaseUntil: leaseUntil,
      updatedAt: now,
    })
    .where(
      and(
        eq(agent.id, agentId),
        or(
          isNull(agent.sessionControlLeaseUntil),
          lt(agent.sessionControlLeaseUntil, now)
        )
      )
    )
    .returning({ id: agent.id })

  if (!rows[0]) {
    return null
  }

  return { agentId, leaseId }
}

export async function releaseSessionControlLease(
  lease: SessionControlLease
): Promise<void> {
  await db
    .update(agent)
    .set({
      sessionControlLeaseId: null,
      sessionControlLeaseUntil: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(agent.id, lease.agentId),
        eq(agent.sessionControlLeaseId, lease.leaseId)
      )
    )
}

export async function withSessionControlLease<T>(
  agentId: string,
  callback: (lease: SessionControlLease) => Promise<T>
): Promise<T> {
  const lease = await acquireSessionControlLease(agentId)
  if (!lease) {
    throw new SessionControlLeaseBusyError(agentId)
  }

  try {
    return await callback(lease)
  } finally {
    await releaseSessionControlLease(lease)
  }
}

function readNonNegativeIntegerEnv(
  value: string | undefined,
  fallback: number
): number {
  if (!value) {
    return fallback
  }

  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}
