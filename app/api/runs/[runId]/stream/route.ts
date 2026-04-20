import { eq } from "drizzle-orm"
import { getRun } from "workflow/api"
import { requireSession } from "@/lib/auth-guard"
import { db } from "@/lib/db"
import { runs } from "@/lib/db/schema"
import type { RunEvent } from "@/lib/run-events"

/**
 * Stream workflow progress events as newline-delimited JSON.
 *
 * This follows the canonical pattern from the Workflow SDK docs
 * (foundations/streaming.mdx): return the workflow's readable stream
 * directly, with the minimum transform needed to turn typed events into
 * bytes. No SSE framing, no heartbeats, no Last-Event-ID reconnect
 * gymnastics - just fetch + ReadableStream on the client.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  await requireSession()
  const { runId } = await params

  const [row] = await db.select().from(runs).where(eq(runs.id, runId)).limit(1)
  if (!row) return new Response("not found", { status: 404 })

  const workflowRunId =
    row.workflowRunId ?? (await waitForWorkflowRunId(runId))
  if (!workflowRunId) {
    return new Response(JSON.stringify({ error: "workflow not started" }), {
      status: 409,
      headers: { "Content-Type": "application/json" },
    })
  }

  const encoder = new TextEncoder()
  const source = getRun(workflowRunId).getReadable<RunEvent>({
    namespace: "events",
    startIndex: 0,
  })

  const body = source.pipeThrough(
    new TransformStream<RunEvent, Uint8Array>({
      transform(chunk, controller) {
        controller.enqueue(encoder.encode(JSON.stringify(chunk) + "\n"))
      },
    }),
  )

  return new Response(body, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  })
}

async function waitForWorkflowRunId(
  appRunId: string,
  maxMs = 8000,
): Promise<string | null> {
  const deadline = Date.now() + maxMs
  while (Date.now() < deadline) {
    const [r] = await db
      .select()
      .from(runs)
      .where(eq(runs.id, appRunId))
      .limit(1)
    if (!r) return null
    if (r.workflowRunId) return r.workflowRunId
    if (r.status === "completed" || r.status === "failed") return null
    await new Promise((res) => setTimeout(res, 300))
  }
  return null
}
