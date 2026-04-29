import { eq } from 'drizzle-orm'
import { getRun } from 'workflow/api'
import { getSession } from '@/lib/auth-guard'
import { db } from '@/lib/db'
import { runs } from '@/lib/db/schema'
import { type RunEvent, runEventsNamespace } from '@/lib/run-events'

/**
 * Stream workflow progress events as newline-delimited JSON.
 *
 * In Phase 1 every run is hosted by the agent's long-lived session
 * workflow, so `workflowRunId` is the session run id (the same one
 * shared by chat turns and other heartbeats). To prevent breadcrumb
 * interleaving we route per-run events into a per-run namespace —
 * `events:<runId>` — and read from there here.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  const session = await getSession()
  if (!session) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { runId } = await params
  const [row] = await db.select().from(runs).where(eq(runs.id, runId)).limit(1)
  if (!row) {
    return new Response('not found', { status: 404 })
  }

  const workflowRunId = row.workflowRunId ?? (await waitForWorkflowRunId(runId))
  if (!workflowRunId) {
    return new Response(JSON.stringify({ error: 'workflow not started' }), {
      status: 409,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const run = getRun(workflowRunId)
  try {
    await run.status
  } catch (err) {
    if (!(err instanceof Error && err.name === 'WorkflowRunNotFoundError')) {
      throw err
    }

    return new Response(
      JSON.stringify({
        error: 'workflow unavailable in this environment',
        workflowRunId,
      }),
      {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }

  const source = run.getReadable<RunEvent>({
    namespace: runEventsNamespace(runId),
    startIndex: 0,
  })

  const encoder = new TextEncoder()
  const body = source.pipeThrough(
    new TransformStream<RunEvent, Uint8Array>({
      transform(chunk, controller) {
        controller.enqueue(encoder.encode(`${JSON.stringify(chunk)}\n`))
      },
    })
  )

  return ndjsonResponse(body)
}

function ndjsonResponse(body: BodyInit): Response {
  return new Response(body, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store, no-transform',
      'X-Accel-Buffering': 'no',
    },
  })
}

async function waitForWorkflowRunId(
  appRunId: string,
  maxMs = 8000
): Promise<string | null> {
  const deadline = Date.now() + maxMs
  while (Date.now() < deadline) {
    const [r] = await db
      .select()
      .from(runs)
      .where(eq(runs.id, appRunId))
      .limit(1)
    if (!r) {
      return null
    }
    if (r.workflowRunId) {
      return r.workflowRunId
    }
    if (r.status === 'completed' || r.status === 'failed') {
      return null
    }
    await new Promise((res) => setTimeout(res, 300))
  }
  return null
}
