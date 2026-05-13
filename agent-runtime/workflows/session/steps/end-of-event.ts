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
  | { sourceType: 'dreaming'; sourceId: string | null }
  | { sourceType: 'invocation'; sourceId: string | null }

// Persist review rows, mirror tracked files into `agent_files`, then release
// the system and tool sandboxes. Failures are logged and swallowed so one bad
// flush never poisons the long-lived session loop.
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
    // Nothing to flush if startup never produced a system sandbox for this turn.
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

  // Release per-event tool sandboxes so the next event boots fresh ones.
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

  // Read existing rows so unchanged hashes can be skipped and missing files
  // can be deleted from the mirror.
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

  // Delete rows for tracked files that disappeared from disk.
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
