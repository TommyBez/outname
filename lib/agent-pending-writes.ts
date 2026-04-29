import 'server-only'
import { randomUUID } from 'node:crypto'
import { and, desc, eq, isNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import { type PendingFileWrite, pendingFileWrites } from '@/lib/db/schema'

/**
 * UI-side helpers for the `pending_file_writes` queue.
 *
 * Two responsibilities:
 *
 *   1. **Enqueue** — server actions writing to AGENTS.md / SOUL.md
 *      from the agent settings UI insert a row here. The drain step
 *      that runs at the top of every session event picks rows up and
 *      applies them to the system sandbox, then stamps `applied_at`.
 *      The memory_* tools refuse to mutate persona files, so this is
 *      the only path that can.
 *
 *   2. **Read latest** — the create / edit form prefills its tabs
 *      from the most recent row per path (applied or not) so the
 *      operator sees what's effectively on disk. Rows are never
 *      deleted, which gives us a free audit log and makes prefill
 *      trivial.
 *
 * Both helpers live outside the workflow sandbox — they're plain DB
 * calls invoked from server actions / RSC loaders.
 */

export const PENDING_PERSONA_PATHS = ['AGENTS.md', 'SOUL.md'] as const
export type PendingPersonaPath = (typeof PENDING_PERSONA_PATHS)[number]

function isPendingPersonaPath(path: string): path is PendingPersonaPath {
  return (PENDING_PERSONA_PATHS as readonly string[]).includes(path)
}

/**
 * Insert a new pending-write row for `path`. The drain step picks it
 * up on the next session event. Returns the row id so callers can
 * thread it into telemetry if they want.
 *
 * Defense-in-depth: this is the *only* code path that bypasses the
 * memory_* tool layer's persona-file write block, so the queue MUST
 * be locked to the persona surface. Any future caller that tries to
 * enqueue an arbitrary path (e.g. "journal.md") would otherwise sneak
 * a write past `isReadOnlyForAgent`. We refuse non-persona paths
 * here instead of trusting every call site to hardcode the constant.
 */
export async function enqueuePendingFileWrite(input: {
  agentId: string
  path: string
  content: string
}): Promise<string> {
  if (!isPendingPersonaPath(input.path)) {
    throw new Error(
      `enqueuePendingFileWrite: path ${JSON.stringify(input.path)} is not a persona file. Only ${PENDING_PERSONA_PATHS.join(' / ')} may be queued.`
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

/**
 * Read the most recent pending-write row for `(agentId, path)`,
 * applied or not. Used by the agent-form RSC to prefill the
 * Identity / Instructions tabs.
 *
 * Returns `null` if the user has never authored this path through
 * the UI. The form layer decides what default to show in that case
 * (empty for SOUL.md, the AGENTS.md seed template for AGENTS.md).
 */
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

/**
 * Read every unapplied pending-write row for `agentId`, oldest
 * first. The drain step uses this to flush in enqueue order. Path
 * collisions are intentional — if the operator saved twice in a row
 * we want the second value to win, which it will because the older
 * row's write is overwritten by the newer one in `writeFiles`.
 *
 * Returns the rows themselves (not just paths) so the caller can
 * stamp `applied_at` by id.
 */
export async function listUnappliedPendingFileWrites(input: {
  agentId: string
}): Promise<PendingFileWrite[]> {
  return db
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

/**
 * Stamp `applied_at = now()` on the listed ids. Called by the drain
 * step after `sandbox.writeFiles` has resolved.
 */
export async function markPendingFileWritesApplied(input: {
  ids: string[]
}): Promise<void> {
  if (input.ids.length === 0) {
    return
  }
  // drizzle's `inArray` would be cleaner, but the queue is short and
  // a simple loop keeps the call site uniform with the other helpers.
  await Promise.all(
    input.ids.map((id) =>
      db
        .update(pendingFileWrites)
        .set({ appliedAt: new Date() })
        .where(eq(pendingFileWrites.id, id))
    )
  )
}
