import { revalidateTag } from 'next/cache'
import { getWorkflowMetadata } from 'workflow'
import { agentRunsTag, runsIndexTag } from '@/lib/cache-tags'
import { db } from '@/lib/db'
import { runs } from '@/lib/db/schema'

/**
 * Insert the `runs` row for a heartbeat-driven invocation.
 *
 * Phase 1 keeps the existing `runs` schema and the `/runs` UI working
 * unchanged — every heartbeat produces one row whose lifecycle
 * (`running` → `completed`/`failed`) is owned by the existing
 * `finalizeRun` step. We backfill `workflowRunId` with the current
 * session workflow's runtime id so the `/runs/:runId/stream` route can
 * still resolve the workflow and surface live progress.
 *
 * Returns the freshly generated internal run id; the heartbeat handler
 * threads it through every downstream step (init-run, prepare-brief,
 * persistRunResult, finalize-run) via `runId` arguments.
 */
export async function beginHeartbeatRun(input: {
  agentId: string
}): Promise<{ runId: string }> {
  'use step'

  const runId = nanoid()

  // `getWorkflowMetadata()` is available inside step functions and
  // returns the runtime id of the *currently executing* workflow run —
  // for us, the long-lived session run. Wiring it into the runs row's
  // `workflowRunId` lets the existing /runs stream route resolve a
  // namespace under the session workflow without us having to thread
  // the value down from the workflow body.
  let workflowRunId: string | null = null
  try {
    workflowRunId = getWorkflowMetadata().workflowRunId
  } catch {
    // Outside a workflow context (e.g. unit tests) — leave it null.
  }

  await db.insert(runs).values({
    id: runId,
    agentId: input.agentId,
    status: 'running',
    startedAt: new Date(),
    workflowRunId,
  })

  revalidateTag(agentRunsTag(input.agentId), 'max')
  revalidateTag(runsIndexTag(), 'max')

  return { runId }
}

function nanoid(): string {
  return (
    Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
  )
}
