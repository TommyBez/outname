import { eq } from "drizzle-orm"
import { getRun } from "workflow/api"
import { requireSession } from "@/lib/auth-guard"
import { db } from "@/lib/db"
import { runs } from "@/lib/db/schema"
import type { RunEvent } from "@/lib/run-events"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const encoder = new TextEncoder()

function sseLine(id: number, event: RunEvent | { type: "meta"; message: string }): Uint8Array {
  return encoder.encode(`id: ${id}\nevent: message\ndata: ${JSON.stringify(event)}\n\n`)
}

function sseDone(): Uint8Array {
  return encoder.encode(`event: done\ndata: {}\n\n`)
}

async function waitForWorkflowRunId(
  appRunId: string,
  maxMs = 5000,
): Promise<string | null> {
  const deadline = Date.now() + maxMs
  while (Date.now() < deadline) {
    const [row] = await db.select().from(runs).where(eq(runs.id, appRunId)).limit(1)
    if (!row) return null
    if (row.workflowRunId) return row.workflowRunId
    if (row.status !== "running") return null
    await new Promise((r) => setTimeout(r, 250))
  }
  return null
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  await requireSession()
  const { runId } = await params

  const [row] = await db.select().from(runs).where(eq(runs.id, runId)).limit(1)
  if (!row) return new Response("not found", { status: 404 })

  const workflowRunId = row.workflowRunId ?? (await waitForWorkflowRunId(runId))
  const lastEventIdHeader = request.headers.get("last-event-id")
  const parsedStart = lastEventIdHeader ? parseInt(lastEventIdHeader, 10) : NaN
  const startIndex = Number.isFinite(parsedStart) ? parsedStart + 1 : undefined

  // If the run already finished and we have no workflow id, close immediately.
  if (!workflowRunId) {
    const stream = new ReadableStream({
      start(controller) {
        if (row.status === "failed") {
          controller.enqueue(
            sseLine(0, {
              type: "run",
              status: "failed",
              message: row.error ?? "Run failed before workflow started",
              ts: Date.now(),
            }),
          )
        } else if (row.status === "completed") {
          controller.enqueue(
            sseLine(0, {
              type: "run",
              status: "completed",
              message: "Run complete",
              ts: Date.now(),
            }),
          )
        } else {
          controller.enqueue(
            sseLine(0, {
              type: "meta",
              message: "Workflow starting...",
            }),
          )
        }
        controller.enqueue(sseDone())
        controller.close()
      },
    })
    return new Response(stream, { headers: sseHeaders() })
  }

  let idx = startIndex ?? 0
  const source = getRun(workflowRunId).getReadable<RunEvent>({
    namespace: "events",
    startIndex,
  })

  const sse = source.pipeThrough(
    new TransformStream<RunEvent, Uint8Array>({
      transform(chunk, controller) {
        try {
          controller.enqueue(sseLine(idx, chunk))
          idx += 1
        } catch {
          // Client disconnected; swallow the write and let the stream close.
        }
      },
      flush(controller) {
        try {
          controller.enqueue(sseDone())
        } catch {
          // No-op on closed controller.
        }
      },
    }),
  )

  return new Response(sse, { headers: sseHeaders() })
}

function sseHeaders(): HeadersInit {
  return {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    // Disable any proxy buffering so events arrive promptly.
    "X-Accel-Buffering": "no",
  }
}
