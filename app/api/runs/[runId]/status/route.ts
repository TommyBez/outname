import { eq } from 'drizzle-orm'
import { revalidateTag } from 'next/cache'
import { NextResponse } from 'next/server'
import { getRun } from 'workflow/api'
import { requireSession } from '@/lib/auth-guard'
import { agentRunsTag, runsIndexTag, runTag } from '@/lib/cache-tags'
import { db } from '@/lib/db'
import { runs } from '@/lib/db/schema'

function workflowStatusToLiveString(status: unknown): string | null {
  if (typeof status === 'string') {
    return status
  }
  if (status && typeof status === 'object' && 'state' in status) {
    const st = (status as { state: unknown }).state
    return typeof st === 'string' ? st : null
  }
  return null
}

type RunRow = typeof runs.$inferSelect

async function reconcileRunningRunWithWorkflow(row: RunRow): Promise<{
  finalCompletedAt: Date | null
  finalError: string | null
  finalStatus: RunRow['status']
  liveStatus: string | null
}> {
  let finalStatus = row.status
  let finalError = row.error
  let finalCompletedAt = row.completedAt
  let liveStatus: string | null = null

  try {
    const r = getRun(row.workflowRunId as string)
    const s = await r.status
    liveStatus = workflowStatusToLiveString(s)

    if (liveStatus !== 'failed' && liveStatus !== 'completed') {
      return {
        finalStatus,
        finalError,
        finalCompletedAt,
        liveStatus,
      }
    }

    const completedAt = new Date()
    const reconciled: 'completed' | 'failed' =
      liveStatus === 'failed' ? 'failed' : 'completed'
    const errorMsg =
      reconciled === 'failed'
        ? (row.error ??
          'Workflow reported failure but no error was persisted. Check Vercel logs.')
        : null

    await db
      .update(runs)
      .set({ status: reconciled, completedAt, error: errorMsg })
      .where(eq(runs.id, row.id))

    if (row.agentId) {
      revalidateTag(agentRunsTag(row.agentId), 'max')
    }
    revalidateTag(runTag(row.id), 'max')
    revalidateTag(runsIndexTag(), 'max')

    finalStatus = reconciled
    finalError = errorMsg
    finalCompletedAt = completedAt
  } catch (err) {
    liveStatus =
      err instanceof Error && err.name === 'WorkflowRunNotFoundError'
        ? 'unavailable'
        : null
  }

  return {
    finalStatus,
    finalError,
    finalCompletedAt,
    liveStatus,
  }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  await requireSession()
  const { runId } = await params

  const [row] = await db.select().from(runs).where(eq(runs.id, runId)).limit(1)
  if (!row) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }

  let finalStatus = row.status
  let finalError = row.error
  let finalCompletedAt = row.completedAt
  let liveStatus: string | null = null

  if (row.workflowRunId && row.status === 'running') {
    const reconciled = await reconcileRunningRunWithWorkflow(row)
    finalStatus = reconciled.finalStatus
    finalError = reconciled.finalError
    finalCompletedAt = reconciled.finalCompletedAt
    liveStatus = reconciled.liveStatus
  }

  return NextResponse.json({
    runId: row.id,
    workflowRunId: row.workflowRunId,
    status: finalStatus,
    liveStatus,
    startedAt: row.startedAt,
    completedAt: finalCompletedAt,
    error: finalError,
  })
}
