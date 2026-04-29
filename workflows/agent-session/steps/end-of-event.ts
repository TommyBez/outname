import { createHash } from 'node:crypto'
import type { Sandbox } from '@vercel/sandbox'
import { and, eq } from 'drizzle-orm'
import {
  getExecSandbox,
  getSystemSandbox,
  releaseSandbox,
} from '@/lib/agent-sandbox'
import { SYSTEM_SANDBOX_ROOT } from '@/lib/agent-sandbox-registry'
import { db } from '@/lib/db'
import { agentFiles } from '@/lib/db/schema'
import {
  flushPendingWrites,
  type PendingWrites,
} from '@/workflows/agent-session/tools/pending-writes'

/**
 * End-of-event handler.
 *
 *   1. Flush the per-event `PendingWrites` overlay into the system
 *      sandbox so memory tool writes/edits/deletes the model performed
 *      this turn become durable.
 *   2. Enumerate every `*.md` file under `SYSTEM_SANDBOX_ROOT`,
 *      excluding hidden + node_modules trees.
 *   3. Read each file, hash it, and upsert into `agent_files` keyed by
 *      `(agent_id, path)`. Unchanged files (matching sha256) are
 *      skipped to keep DB churn low. Deletes the rows for files no
 *      longer in the sandbox so `/agents/:id/files` doesn't show
 *      ghost entries.
 *   4. Stop BOTH the system and exec sandboxes so Vercel snapshots
 *      their filesystems ready for the next event's resume.
 *
 * Failures inside this step never crash the session loop — they're
 * swallowed (with a log) so a transient sandbox or DB hiccup doesn't
 * prevent the agent from receiving the next event. The next event
 * will reflush the changed files anyway.
 */
export async function endOfEvent(input: {
  agentId: string
  pending: PendingWrites
}): Promise<void> {
  'use step'

  let systemSandbox: Sandbox | null = null
  let execSandbox: Sandbox | null = null

  try {
    systemSandbox = await getSystemSandbox(input.agentId)
  } catch (err) {
    // No system sandbox means startup never ran for this event — the
    // session loop will boot one on the next event. Nothing to flush.
    console.error('[v0] endOfEvent: getSystemSandbox failed', err)
    return
  }

  try {
    await flushPendingWrites(systemSandbox, input.pending)
  } catch (err) {
    console.error('[v0] endOfEvent: flushPendingWrites failed', err)
  }

  try {
    await mirrorMemoryToDb(systemSandbox, input.agentId)
  } catch (err) {
    console.error('[v0] endOfEvent: mirrorMemoryToDb failed', err)
  }

  // Best-effort exec snapshot: not every event touches it, but if the
  // agent shelled into it during the turn we want the filesystem
  // checkpointed.
  try {
    execSandbox = await getExecSandbox(input.agentId)
  } catch {
    /* no exec sandbox booted — fine */
  }

  await Promise.all(
    [systemSandbox, execSandbox]
      .filter((s): s is Sandbox => s !== null)
      .map((s) => releaseSandbox(s))
  )
}

async function mirrorMemoryToDb(
  sandbox: Sandbox,
  agentId: string
): Promise<void> {
  // Enumerate markdown files. `find` is GNU-compatible inside the
  // node22 sandbox image; we filter out hidden trees and node_modules
  // up front so we don't spend bytes on noise.
  const list = await sandbox.runCommand({
    cmd: 'sh',
    args: [
      '-ec',
      `cd ${SYSTEM_SANDBOX_ROOT} && find . -type f -name '*.md' \
        -not -path './.*' \
        -not -path './node_modules/*' \
        -print 2>/dev/null || true`,
    ],
  })
  const stdout = await list.stdout()
  const relPaths = stdout
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((p) => (p.startsWith('./') ? p.slice(2) : p))

  // Read existing rows so we can (a) skip unchanged hashes and (b)
  // delete rows whose sandbox file is gone.
  const existing = await db
    .select({ path: agentFiles.path, sha256: agentFiles.sha256 })
    .from(agentFiles)
    .where(eq(agentFiles.agentId, agentId))
  const existingByPath = new Map(existing.map((r) => [r.path, r.sha256]))
  const seen = new Set<string>()

  for (const relPath of relPaths) {
    seen.add(relPath)
    const absPath = `${SYSTEM_SANDBOX_ROOT}/${relPath}`
    const buf = await sandbox
      .readFileToBuffer({ path: absPath })
      .catch(() => null)
    if (!buf) {
      continue
    }

    const content = buf.toString('utf8')
    const sha = createHash('sha256').update(content).digest('hex')
    if (existingByPath.get(relPath) === sha) {
      continue
    }

    await db
      .insert(agentFiles)
      .values({
        agentId,
        path: relPath,
        content,
        sha256: sha,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [agentFiles.agentId, agentFiles.path],
        set: {
          content,
          sha256: sha,
          updatedAt: new Date(),
        },
      })
  }

  // Delete rows for memory files that no longer exist on disk. Uses
  // a per-row delete to keep the WHERE clause small; the typical
  // delete count is 0–1 per turn.
  for (const path of existingByPath.keys()) {
    if (seen.has(path)) {
      continue
    }
    await db
      .delete(agentFiles)
      .where(and(eq(agentFiles.agentId, agentId), eq(agentFiles.path, path)))
  }
}
