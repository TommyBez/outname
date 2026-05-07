import { createHash } from 'node:crypto'
import type { Sandbox } from '@vercel/sandbox'
import { and, eq } from 'drizzle-orm'
import { revalidateTag } from 'next/cache'
import {
  getExecSandbox,
  getSystemSandbox,
  isSandboxStoppedError,
  releaseSandbox,
} from '@/lib/agent-sandbox'
import { SYSTEM_SANDBOX_ROOT } from '@/lib/agent-sandbox-registry'
import { agentTag } from '@/lib/cache-tags'
import { db } from '@/lib/db'
import { agentFileChanges, agentFiles } from '@/lib/db/schema'
import { stopAllToolSandboxesForRun } from '@/lib/tool-sandbox-runtime'
import { stopAllBrokeredHttpSandboxesForRun } from '@/tools/brokered-http'
import {
  flushPendingWrites,
  type PendingWrites,
  readLiveMemory,
} from '@/workflows/agent-session/tools/pending-writes'
import { isCurrentSessionOwner } from './session-ownership'

type EndOfEventSource =
  | { sourceType: 'chat'; sourceId: string | null }
  | { sourceType: 'heartbeat'; sourceId: string | null }
  | { sourceType: 'reflection'; sourceId: string | null }
  | { sourceType: 'invocation'; sourceId: string | null }

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
  sessionRunId: string
  source: EndOfEventSource
}): Promise<void> {
  'use step'

  try {
    if (!(await isCurrentSessionOwner(input))) {
      console.warn('[v0] endOfEvent: stale session skipped finalization', {
        agentId: input.agentId,
        sessionRunId: input.sessionRunId,
      })
      return
    }

    const systemSandbox = await finalizeSystemSandboxWithRetry(input)

    if (!(await isCurrentSessionOwner(input))) {
      console.warn('[v0] endOfEvent: owner changed before release', {
        agentId: input.agentId,
        sessionRunId: input.sessionRunId,
      })
      return
    }

    const execSandbox = await getOptionalExecSandbox(input.agentId)
    await Promise.all(
      [systemSandbox, execSandbox]
        .filter((s): s is Sandbox => s !== null)
        .map((s) => releaseSandbox(s))
    )
  } catch (err) {
    console.error('[v0] endOfEvent: finalization failed', err)
  } finally {
    // Tear down maintainer-tool sandboxes spawned during this event so
    // the next event boots fresh. Errors are logged-and-swallowed inside
    // the helpers; this catch is a final guard for the session loop.
    await Promise.all([
      stopAllToolSandboxesForRun(),
      stopAllBrokeredHttpSandboxesForRun(),
    ]).catch((err) => {
      console.error('[v0] endOfEvent: tool sandbox cleanup failed', err)
    })
  }
}

async function finalizeSystemSandboxWithRetry(input: {
  agentId: string
  pending: PendingWrites
  sessionRunId: string
  source: EndOfEventSource
}): Promise<Sandbox | null> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    let sandbox: Sandbox | null = null
    try {
      sandbox = await getSystemSandbox(input.agentId)
      await finalizeSystemSandbox({ ...input, sandbox })
      return sandbox
    } catch (err) {
      if (
        attempt === 0 &&
        isSandboxStoppedError(err) &&
        (await isCurrentSessionOwner(input))
      ) {
        console.warn('[v0] endOfEvent: sandbox stopped, reacquiring once', {
          agentId: input.agentId,
          sessionRunId: input.sessionRunId,
        })
        continue
      }

      console.error('[v0] endOfEvent: system sandbox finalization failed', err)
      return sandbox
    }
  }

  return null
}

async function finalizeSystemSandbox(input: {
  agentId: string
  pending: PendingWrites
  sandbox: Sandbox
  source: EndOfEventSource
}): Promise<void> {
  const reviewPaths = collectReviewPaths(input.pending)
  let beforeReviewContent: Map<string, string | null> | null = null

  try {
    beforeReviewContent = await readReviewFiles(input.sandbox, reviewPaths)
  } catch (err) {
    rethrowIfSandboxStopped(err)
    console.error('[v0] endOfEvent: readReviewFiles failed', err)
  }

  try {
    await flushPendingWrites(input.sandbox, input.pending)
  } catch (err) {
    rethrowIfSandboxStopped(err)
    console.error('[v0] endOfEvent: flushPendingWrites failed', err)
  }

  if (beforeReviewContent) {
    try {
      await persistReviewChanges({
        agentId: input.agentId,
        beforeByPath: beforeReviewContent,
        paths: reviewPaths,
        sandbox: input.sandbox,
        source: input.source,
      })
    } catch (err) {
      rethrowIfSandboxStopped(err)
      console.error('[v0] endOfEvent: persistReviewChanges failed', err)
    }
  }

  try {
    await mirrorMemoryToDb(input.sandbox, input.agentId)
    revalidateTag(agentTag(input.agentId), 'max')
  } catch (err) {
    rethrowIfSandboxStopped(err)
    console.error('[v0] endOfEvent: mirrorMemoryToDb failed', err)
  }
}

async function getOptionalExecSandbox(
  agentId: string
): Promise<Sandbox | null> {
  // Best-effort exec snapshot: not every event touches it, but if the
  // agent shelled into it during the turn we want the filesystem
  // checkpointed.
  try {
    return await getExecSandbox(agentId)
  } catch {
    return null
  }
}

function rethrowIfSandboxStopped(err: unknown): void {
  if (isSandboxStoppedError(err)) {
    throw err
  }
}

function collectReviewPaths(pending: PendingWrites): string[] {
  const paths = new Set<string>()
  for (const op of pending.ops) {
    if (isReviewPath(op.path)) {
      paths.add(op.path)
    }
  }
  return Array.from(paths).sort()
}

function isReviewPath(path: string): boolean {
  return (
    path === 'DREAMS.md' ||
    path === 'GOALS.md' ||
    path === 'TASKS.md' ||
    path.startsWith('logs/')
  )
}

async function readReviewFiles(
  sandbox: Sandbox,
  paths: readonly string[]
): Promise<Map<string, string | null>> {
  const entries = await Promise.all(
    paths.map(
      async (path) => [path, await readLiveMemory(sandbox, path)] as const
    )
  )
  return new Map(entries)
}

async function persistReviewChanges(input: {
  agentId: string
  beforeByPath: Map<string, string | null>
  paths: readonly string[]
  sandbox: Sandbox
  source: EndOfEventSource
}): Promise<void> {
  for (const path of input.paths) {
    const before = input.beforeByPath.get(path) ?? null
    const after = await readLiveMemory(input.sandbox, path)
    if (before === after) {
      continue
    }

    await db.insert(agentFileChanges).values({
      id: fileChangeId(),
      agentId: input.agentId,
      path,
      sourceType: input.source.sourceType,
      sourceId: input.source.sourceId,
      beforeContent: before,
      afterContent: after,
      beforeSha256: before === null ? null : sha256(before),
      afterSha256: after === null ? null : sha256(after),
      createdAt: new Date(),
    })
  }
}

function fileChangeId(): string {
  return (
    'chg_' +
    Math.random().toString(36).slice(2, 10) +
    Date.now().toString(36).slice(-4)
  )
}

function sha256(content: string): string {
  return createHash('sha256').update(content).digest('hex')
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
      .catch((err) => {
        rethrowIfSandboxStopped(err)
        return null
      })
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
