import 'server-only'
import { randomUUID } from 'node:crypto'
import { and, desc, eq, isNull } from 'drizzle-orm'
import { db } from '@/shared/db'
import { type PendingFileWrite, pendingFileWrites } from '@/shared/db/schema'

export const PENDING_BOOTSTRAP_PATHS = [
  'AGENTS.md',
  'IDENTITY.md',
  'SOUL.md',
  'USER.md',
] as const
export type PendingBootstrapPath = (typeof PENDING_BOOTSTRAP_PATHS)[number]

function isPendingBootstrapPath(path: string): path is PendingBootstrapPath {
  return (PENDING_BOOTSTRAP_PATHS as readonly string[]).includes(path)
}

// This queue is reserved for settings-managed bootstrap files, not arbitrary sandbox writes.
export async function enqueuePendingFileWrite(input: {
  agentId: string
  path: string
  content: string
}): Promise<string> {
  if (!isPendingBootstrapPath(input.path)) {
    throw new Error(
      `enqueuePendingFileWrite: path ${JSON.stringify(input.path)} is not a settings-managed bootstrap file. Only ${PENDING_BOOTSTRAP_PATHS.join(' / ')} may be queued.`
    )
  }
  const id = randomUUID()
  await db.insert(pendingFileWrites).values({
    id,
    agentId: input.agentId,
    path: input.path,
    content: input.content,
  })
  return id
}

export async function readLatestPendingFileWrite(input: {
  agentId: string
  path: string
}): Promise<PendingFileWrite | null> {
  const [row] = await db
    .select()
    .from(pendingFileWrites)
    .where(
      and(
        eq(pendingFileWrites.agentId, input.agentId),
        eq(pendingFileWrites.path, input.path)
      )
    )
    .orderBy(desc(pendingFileWrites.enqueuedAt))
    .limit(1)
  return row ?? null
}

export async function listUnappliedPendingFileWrites(input: {
  agentId: string
}): Promise<PendingFileWrite[]> {
  return await db
    .select()
    .from(pendingFileWrites)
    .where(
      and(
        eq(pendingFileWrites.agentId, input.agentId),
        isNull(pendingFileWrites.appliedAt)
      )
    )
    .orderBy(pendingFileWrites.enqueuedAt)
}

export async function markPendingFileWritesApplied(input: {
  ids: string[]
}): Promise<void> {
  if (input.ids.length === 0) {
    return
  }
  await Promise.all(
    input.ids.map((id) =>
      db
        .update(pendingFileWrites)
        .set({ appliedAt: new Date() })
        .where(eq(pendingFileWrites.id, id))
    )
  )
}
