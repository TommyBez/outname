import 'server-only'
import { and, desc, eq, inArray } from 'drizzle-orm'
import { getRun, start } from 'workflow/api'
import { db } from '@/shared/db/pool'
import { toolSandboxBuilds, toolSandboxSnapshots } from '@/shared/db/schema'
import { buildToolSandboxWorkflow } from '@/tools/sandbox-runtime/workflow/workflow'
import { manifestHash } from '@/tools/sandboxes'

const TERMINAL_WORKFLOW_STATUSES = new Set(['completed', 'failed', 'cancelled'])

// Server-action helper for attach: reuse a matching snapshot, coalesce onto an
// active build for the same `(manifest, hash)`, or start a fresh workflow. A
// retry is safe because the manifest hash is the idempotency key.
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
    // Surface a terminal failure immediately so the UI does not spin forever.
    console.error(
      'ensureToolSandboxBuild: start(buildToolSandboxWorkflow) failed',
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

// Polling fallback for the catalog UI when the workflow stream is unavailable.
// In-flight progress stays stream-only; this exposes terminal row state only.
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

// Used by the tools page to pair a pending attachment row with its latest build.
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
