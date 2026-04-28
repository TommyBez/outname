import { getSystemSandbox } from "@/lib/agent-sandbox"
import {
  listUnappliedPendingFileWrites,
  markPendingFileWritesApplied,
} from "@/lib/agent-pending-writes"

/**
 * Apply every unapplied row from `pending_file_writes` for `agentId`
 * to the system sandbox, then stamp `applied_at`.
 *
 * Called from session-event handlers after `startupSystemSandbox`
 * but before `buildAgent`, so the new persona content is already on
 * disk by the time `composeSystemPrompt` reads it.
 *
 * The order matters:
 *   1. Read the queue (rows are returned oldest-first).
 *   2. `sandbox.writeFiles` in a single call — overlapping paths in
 *      the queue collapse naturally, last write wins.
 *   3. Mark every id applied.
 *
 * If an exception is thrown between 2 and 3 the rows stay
 * unapplied; the next event will retry, which means a write may be
 * applied twice on retry. That is fine — `writeFiles` is
 * deterministic and idempotent for our content.
 *
 * Marked `"use step"` because it touches both Neon (DB) and Vercel
 * Sandbox — neither is available inside the workflow sandbox.
 */
export async function drainPendingWrites(input: {
  agentId: string
}): Promise<{ applied: number }> {
  "use step"
  const { agentId } = input

  const queued = await listUnappliedPendingFileWrites({ agentId })
  if (queued.length === 0) return { applied: 0 }

  const sandbox = await getSystemSandbox(agentId)

  await sandbox.writeFiles(
    queued.map((row) => ({
      path: row.path,
      content: Buffer.from(row.content, "utf8"),
    })),
  )

  await markPendingFileWritesApplied({ ids: queued.map((r) => r.id) })

  return { applied: queued.length }
}
