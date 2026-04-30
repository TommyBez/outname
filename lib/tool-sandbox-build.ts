import 'server-only'
import { and, desc, eq, inArray } from 'drizzle-orm'
import { getRun, start } from 'workflow/api'
import { db } from '@/lib/db'
import { toolSandboxBuilds, toolSandboxSnapshots } from '@/lib/db/schema'
import { manifestHash } from '@/tools/sandboxes'
import { buildToolSandboxWorkflow } from '@/workflows/build-tool-sandbox/workflow'

const TERMINAL_WORKFLOW_STATUSES = new Set(['completed', 'failed', 'cancelled'])

/**
 * Phase 4: server-side helper used by `attachToolAction` to ensure a
 * tool-sandbox snapshot exists (or that a build is running) for a
 * given manifest.
 *
 *   - Fast path: snapshot already matches the current `manifestHash`
 *     → return `{ state: 'ready', snapshotId }`.
 *   - Coalesce: there is already an in-flight build for the same
 *     (manifest, hash) → return its `buildId` so concurrent attaches
 *     can subscribe to the same workflow run.
 *   - Otherwise: insert a fresh `tool_sandbox_builds` row, kick off
 *     `buildToolSandboxWorkflow`, persist the workflow run id back
 *     onto the row, and return the new `buildId`.
 *
 * No `'use step'` here — this runs inside a Next.js server action,
 * not a workflow execution context. Idempotency comes from the
 * manifest-hash check, so a retry after failure (the user clicking
 * the Retry button) is safe.
 */
export type EnsureToolSandboxBuildResult =
  | { state: 'ready'; snapshotId: string }
  | { state: 'building'; buildId: string }

function newBuildId(): string {
  return `tsb_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`
}

export async function ensureToolSandboxBuild(input: {
  manifestId: string
}): Promise<EnsureToolSandboxBuildResult> {
  const { manifestId } = input
  const desiredHash = manifestHash(manifestId)

  // Fast path: snapshot already matches.
  const [snap] = await db
    .select()
    .from(toolSandboxSnapshots)
    .where(eq(toolSandboxSnapshots.manifestId, manifestId))
    .limit(1)
  if (snap && snap.manifestHash === desiredHash) {
    return { state: 'ready', snapshotId: snap.snapshotId }
  }

  const running = await findReusableActiveBuild(manifestId, desiredHash)
  if (running) {
    return { state: 'building', buildId: running.id }
  }

  // No fresh snapshot, no in-flight build — start one.
  const buildId = newBuildId()
  try {
    await db.insert(toolSandboxBuilds).values({
      id: buildId,
      manifestId,
      manifestHash: desiredHash,
      status: 'pending',
    })
  } catch (err) {
    if (isUniqueViolation(err)) {
      const coalesced = await findReusableActiveBuild(manifestId, desiredHash)
      if (coalesced) {
        return { state: 'building', buildId: coalesced.id }
      }
      return ensureToolSandboxBuild({ manifestId })
    }
    throw err
  }

  let workflowRunId: string | null = null
  try {
    const run = await start(buildToolSandboxWorkflow, [{ buildId }])
    workflowRunId = run.runId
  } catch (err) {
    // If the workflow refused to start, mark the row failed so the UI
    // doesn't spin forever.
    console.error(
      '[v0] ensureToolSandboxBuild: start(buildToolSandboxWorkflow) failed',
      err
    )
    await db
      .update(toolSandboxBuilds)
      .set({
        status: 'failed',
        finishedAt: new Date(),
        errorText:
          err instanceof Error ? err.message : 'failed to start build workflow',
      })
      .where(eq(toolSandboxBuilds.id, buildId))
    throw err
  }

  await db
    .update(toolSandboxBuilds)
    .set({ workflowRunId })
    .where(eq(toolSandboxBuilds.id, buildId))

  return { state: 'building', buildId }
}

async function findReusableActiveBuild(
  manifestId: string,
  desiredHash: string
): Promise<{ id: string } | null> {
  const active = await findActiveBuild(manifestId, desiredHash)
  if (!active) {
    return null
  }

  if (!(await activeBuildIsAlive(active.workflowRunId))) {
    await markAbandonedBuildFailed(active.id)
    return null
  }

  return { id: active.id }
}

async function findActiveBuild(
  manifestId: string,
  desiredHash: string
): Promise<{ id: string; workflowRunId: string | null } | null> {
  const [running] = await db
    .select({
      id: toolSandboxBuilds.id,
      workflowRunId: toolSandboxBuilds.workflowRunId,
    })
    .from(toolSandboxBuilds)
    .where(
      and(
        eq(toolSandboxBuilds.manifestId, manifestId),
        eq(toolSandboxBuilds.manifestHash, desiredHash),
        inArray(toolSandboxBuilds.status, ['pending', 'running'])
      )
    )
    .orderBy(desc(toolSandboxBuilds.startedAt))
    .limit(1)
  return running ?? null
}

async function activeBuildIsAlive(
  workflowRunId: string | null
): Promise<boolean> {
  if (!workflowRunId) {
    return true
  }
  try {
    const status = await getRun(workflowRunId).status
    return typeof status === 'string' && !TERMINAL_WORKFLOW_STATUSES.has(status)
  } catch {
    return false
  }
}

async function markAbandonedBuildFailed(buildId: string): Promise<void> {
  await db
    .update(toolSandboxBuilds)
    .set({
      status: 'failed',
      finishedAt: new Date(),
      errorText: 'Build workflow ended before producing a snapshot',
    })
    .where(eq(toolSandboxBuilds.id, buildId))
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: unknown }).code === '23505'
  )
}

/**
 * Read the current terminal state of a build row. Used as the
 * polling-fallback path in the catalog UI when the workflow stream
 * isn't reachable (e.g. the run record has expired). Per-step
 * progress messages are NOT exposed here — the stream is the single
 * source of truth for in-flight progress.
 */
export async function readToolSandboxBuildStatus(buildId: string): Promise<{
  status: 'pending' | 'running' | 'ready' | 'failed'
  errorText: string | null
} | null> {
  const [row] = await db
    .select({
      status: toolSandboxBuilds.status,
      errorText: toolSandboxBuilds.errorText,
    })
    .from(toolSandboxBuilds)
    .where(eq(toolSandboxBuilds.id, buildId))
    .limit(1)
  return row ?? null
}

/**
 * Lookup the most recent build row for a manifest, used by the tools
 * page to render an in-flight progress strip alongside a `pending`
 * agent_tools row.
 */
export async function getLatestBuildForManifest(
  manifestId: string,
  manifestHash?: string
): Promise<{
  id: string
  status: 'pending' | 'running' | 'ready' | 'failed'
  errorText: string | null
} | null> {
  const predicates = [eq(toolSandboxBuilds.manifestId, manifestId)]
  if (manifestHash) {
    predicates.push(eq(toolSandboxBuilds.manifestHash, manifestHash))
  }
  const [row] = await db
    .select({
      id: toolSandboxBuilds.id,
      status: toolSandboxBuilds.status,
      errorText: toolSandboxBuilds.errorText,
    })
    .from(toolSandboxBuilds)
    .where(and(...predicates))
    .orderBy(desc(toolSandboxBuilds.startedAt))
    .limit(1)
  return row ?? null
}
