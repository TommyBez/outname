import { eq } from "drizzle-orm"
import { getRun } from "workflow/api"
import { requireSession } from "@/lib/auth-guard"
import { db } from "@/lib/db"
import { runs } from "@/lib/db/schema"
import type { RunEvent } from "@/lib/run-events"

const encoder = new TextEncoder()

type ClientFrame = RunEvent | { type: "meta"; message: string }

function sseFrame(id: number | null, event: ClientFrame): Uint8Array {
  const idLine = id === null ? "" : `id: ${id}\n`
  return encoder.encode(`${idLine}event: message\ndata: ${JSON.stringify(event)}\n\n`)
}

function sseDone(): Uint8Array {
  return encoder.encode(`event: done\ndata: {}\n\n`)
}

function sseComment(text: string): Uint8Array {
  return encoder.encode(`: ${text}\n\n`)
}

async function waitForWorkflowRunId(
  appRunId: string,
  maxMs = 8000,
): Promise<string | null> {
  const deadline = Date.now() + maxMs
  while (Date.now() < deadline) {
    const [row] = await db.select().from(runs).where(eq(runs.id, appRunId)).limit(1)
    if (!row) return null
    if (row.workflowRunId) return row.workflowRunId
    if (row.status === "completed" || row.status === "failed") return null
    await new Promise((r) => setTimeout(r, 250))
  }
  return null
}

function sseHeaders(): HeadersInit {
  return {
    "Content-Type": "text/event-stream; charset=utf-8",
    // `no-store` guarantees no edge/browser cache touches the SSE response.
    "Cache-Control": "no-store, no-cache, no-transform, must-revalidate",
    Connection: "keep-alive",
    // Disables proxy-level response buffering on Vercel edge.
    "X-Accel-Buffering": "no",
    Pragma: "no-cache",
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  await requireSession()
  const { runId } = await params

  console.log("[v0] sse open", { runId })

  const [row] = await db.select().from(runs).where(eq(runs.id, runId)).limit(1)
  if (!row) {
    console.log("[v0] sse no row", { runId })
    return new Response("not found", { status: 404 })
  }

  const workflowRunId = row.workflowRunId ?? (await waitForWorkflowRunId(runId))
  console.log("[v0] sse resolved wf", {
    runId,
    status: row.status,
    workflowRunId,
  })

  const lastEventIdHeader = request.headers.get("last-event-id")
  const parsedStart = lastEventIdHeader ? parseInt(lastEventIdHeader, 10) : NaN
  // First connect (no Last-Event-ID): replay entire stream from index 0.
  // Reconnect: resume from index N+1.
  const startIndex = Number.isFinite(parsedStart) ? parsedStart + 1 : 0

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false
      const enqueue = (chunk: Uint8Array) => {
        if (closed) return
        try {
          controller.enqueue(chunk)
        } catch {
          closed = true
        }
      }

      // 1) Flush meta frame IMMEDIATELY so the client observes a live
      //    connection without waiting on the workflow store.
      enqueue(sseFrame(null, { type: "meta", message: "stream connected" }))
      // Padding forces the first TCP flush through the edge proxy on some
      // runtimes that coalesce small initial chunks.
      enqueue(sseComment("open"))
      console.log("[v0] sse meta sent", { runId, startIndex })

      // 2) Heartbeat to keep long-lived connection through edge idle timeouts.
      const heartbeat = setInterval(() => {
        enqueue(sseComment(`hb ${Date.now()}`))
      }, 15_000)

      // 3) Client abort (page nav, browser close) cleans up everything.
      const onAbort = () => {
        console.log("[v0] sse client abort", { runId })
        closed = true
        clearInterval(heartbeat)
        try {
          controller.close()
        } catch {}
      }
      request.signal.addEventListener("abort", onAbort)

      // 4) Terminal case: workflow never started. Send done immediately.
      if (!workflowRunId) {
        console.log("[v0] sse no workflow — terminal", { runId })
        enqueue(
          sseFrame(null, {
            type: "meta",
            message: "Workflow not yet started",
          }),
        )
        enqueue(sseDone())
        clearInterval(heartbeat)
        request.signal.removeEventListener("abort", onAbort)
        try {
          controller.close()
        } catch {}
        return
      }

      // 5) Read the workflow's durable event stream directly. On Vercel this
      //    is backed by a Redis-based resumable stream so startIndex:0 yields
      //    all chunks written before we connected AND every subsequent one.
      let source: ReadableStream<RunEvent>
      try {
        source = getRun(workflowRunId).getReadable<RunEvent>({
          namespace: "events",
          startIndex,
        })
      } catch (err) {
        console.error("[v0] sse getReadable threw", err)
        enqueue(
          sseFrame(null, {
            type: "meta",
            message: err instanceof Error ? err.message : "stream error",
          }),
        )
        enqueue(sseDone())
        clearInterval(heartbeat)
        request.signal.removeEventListener("abort", onAbort)
        try {
          controller.close()
        } catch {}
        return
      }

      const reader = source.getReader()
      let idx = startIndex - 1
      let chunkCount = 0
      try {
        while (!closed) {
          const { value, done } = await reader.read()
          if (done) {
            console.log("[v0] sse source done", { runId, chunkCount })
            break
          }
          idx += 1
          chunkCount += 1
          if (chunkCount === 1) {
            console.log("[v0] sse first chunk", {
              runId,
              preview:
                value && typeof value === "object"
                  ? (value as any).type
                  : typeof value,
            })
          }
          enqueue(sseFrame(idx, value))
        }
        enqueue(sseDone())
      } catch (err) {
        console.error("[v0] sse reader loop error", err)
        enqueue(
          sseFrame(null, {
            type: "meta",
            message: err instanceof Error ? err.message : "read error",
          }),
        )
        enqueue(sseDone())
      } finally {
        clearInterval(heartbeat)
        request.signal.removeEventListener("abort", onAbort)
        try {
          reader.releaseLock()
        } catch {}
        try {
          controller.close()
        } catch {}
      }
    },
  })

  return new Response(body, { headers: sseHeaders() })
}
