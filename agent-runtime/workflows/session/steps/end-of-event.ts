import { createHash } from 'node:crypto'
import type { Sandbox } from '@vercel/sandbox'
import { and, eq } from 'drizzle-orm'
import { revalidateTag } from 'next/cache'
import {
  getSystemSandbox,
  releaseSandbox,
  SYSTEM_SANDBOX_ROOT,
} from '@/agent-runtime/server/agent-sandbox'
import {
  type PendingWrites,
  reviewPathsFromPending,
} from '@/agent-runtime/workflows/session/tools/pending-writes'
import { listTrackedArchitectureFiles } from '@/agent-runtime/workflows/session/tools/sandbox-file-helpers/list'
import { db } from '@/shared/db'
import { agentFileChanges, agentFiles } from '@/shared/db/schema'
import { agentTag } from '@/shared/server/cache-tags'
import { stopAllBrokeredHttpSandboxesForRun } from '@/tools/runtime/brokered-http/sandbox'
import { stopAllToolSandboxesForRun } from '@/tools/sandbox-runtime/runtime'

type EndOfEventSource =
  | { sourceType: 'chat'; sourceId: string | null }
  | { sourceType: 'heartbeat'; sourceId: string | null }
  | { sourceType: 'reflection'; sourceId: string | null }
  | { sourceType: 'invocation'; sourceId: string | null }

/**
 * End-of-event handler.
 *
 *   1. Persist before/after review rows for tracked architecture files
 *      touched by immediate `writeFile` calls during this event.
 *   2. Mirror only architecture-defined files from the system sandbox
 *      into `agent_files`: bootstrap/profile files, canonical memory
 *      files, and `logs/*.md`.
 *   3. Stop the system sandbox so Vercel snapshots its filesystem
 *      ready for the next event's resume.
 *
 * Failures inside this step never crash the session loop — they're
 * swallowed (with a log) so a transient sandbox or DB hiccup doesn't
 * prevent the agent from receiving the next event.
 */
export async function endOfEvent(input: {
  agentId: string
  pending: PendingWrites
  source: EndOfEventSource
}): Promise<void> {
  'use step'

  let systemSandbox: Sandbox
  try {
    systemSandbox = await getSystemSandbox(input.agentId)
  } catch (err) {
    // No system sandbox means startup never ran for this event — the
    // session loop will boot one on the next event. Nothing to flush.
    console.error('[v0] endOfEvent: getSystemSandbox failed', err)
    return
  }

  const reviewPaths = reviewPathsFromPending(input.pending)
  const beforeReviewContent = new Map(
    Object.entries(input.pending.beforeByPath)
  )

  try {
    await persistReviewChanges({
      agentId: input.agentId,
      beforeByPath: beforeReviewContent,
      paths: reviewPaths,
      sandbox: systemSandbox,
      source: input.source,
    })
  } catch (err) {
    console.error('[v0] endOfEvent: persistReviewChanges failed', err)
  }

  try {
    await mirrorTrackedFilesToDb(systemSandbox, input.agentId)
    revalidateTag(agentTag(input.agentId), 'max')
  } catch (err) {
    console.error('[v0] endOfEvent: mirrorTrackedFilesToDb failed', err)
  }

  await releaseSandbox(systemSandbox)

  // Tear down maintainer-tool sandboxes spawned during this event so
  // the next event boots fresh. Errors are logged-and-swallowed inside
  // the helpers.
  await Promise.all([
    stopAllToolSandboxesForRun(),
    stopAllBrokeredHttpSandboxesForRun(),
  ])
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
    const after = await readTrackedContent(input.sandbox, path)
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

async function mirrorTrackedFilesToDb(
  sandbox: Sandbox,
  agentId: string
): Promise<void> {
  const relPaths = await listTrackedArchitectureFiles(sandbox)

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
    const content = await readTrackedContent(sandbox, relPath)
    if (content === null) {
      continue
    }

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

  // Delete rows for tracked files that no longer exist on disk. Uses
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

async function readTrackedContent(
  sandbox: Sandbox,
  relPath: string
): Promise<string | null> {
  const buf = await sandbox
    .readFileToBuffer({ path: `${SYSTEM_SANDBOX_ROOT}/${relPath}` })
    .catch(() => null)
  return buf ? buf.toString('utf8') : null
}
