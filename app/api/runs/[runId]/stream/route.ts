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
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  await requireSession()
  const { runId } = await params

  console.log("[v0] sse: open", { runId })

  const [row] = await db.select().from(runs).where(eq(runs.id, runId)).limit(1)
  if (!row) {
    console.log("[v0] sse: run row not found", { runId })
    return new Response("not found", { status: 404 })
  }

  const workflowRunId = row.workflowRunId ?? (await waitForWorkflowRunId(runId))
  console.log("[v0] sse: resolved workflowRunId", {
    runId,
    status: row.status,
    workflowRunId,
  })

  const lastEventIdHeader = request.headers.get("last-event-id")
  const parsedStart = lastEventIdHeader ? parseInt(lastEventIdHeader, 10) : NaN
  // First connect (no Last-Event-ID): replay the ENTIRE stream from chunk 0.
  // Reconnect: resume from chunk index N+1.
  const startIndex = Number.isFinite(parsedStart) ? parsedStart + 1 : 0

  // Terminal: send a final frame + done and close.
  if (!workflowRunId) {
    console.log("[v0] sse: no workflowRunId — terminal meta", { runId })
    return new Response(
      new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(
            sseFrame(null, {
              type: "meta",
              message: "Workflow not yet started",
            }),
          )
          controller.enqueue(sseDone())
          controller.close()
        },
      }),
      { headers: sseHeaders() },
    )
  }

  // Open the live workflow event stream. On Vercel these chunks are backed by
  // a Redis-based durable store, so `startIndex: 0` replays everything that
  // was written before we connected.
  let source: ReadableStream<RunEvent>
  try {
    source = getRun(workflowRunId).getReadable<RunEvent>({
      namespace: "events",
      startIndex,
    })
  } catch (err) {
    console.error("[v0] sse: getReadable failed", err)
    return new Response(
      new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(
            sseFrame(null, {
              type: "meta",
              message:
                err instanceof Error
                  ? `stream error: ${err.message}`
                  : "stream error",
            }),
          )
          controller.enqueue(sseDone())
          controller.close()
        },
      }),
      { headers: sseHeaders() },
    )
  }

  // Convert the workflow's typed event stream into SSE bytes. `start()` sends
  // a meta frame immediately so the client can confirm the connection even if
  // the first real chunk is delayed. `transform()` writes one SSE frame per
  // event with an incrementing `id:` line so the browser's built-in
  // Last-Event-ID reconnection semantics work out of the box. `flush()` sends
  // a terminal `done` event when the workflow closes its stream.
  let idx = startIndex - 1
  const transformer = new TransformStream<RunEvent, Uint8Array>({
    start(controller) {
      controller.enqueue(
        sseFrame(null, { type: "meta", message: "stream connected" }),
      )
      console.log("[v0] sse: sent meta frame", { runId, startIndex })
    },
    transform(event, controller) {
      idx += 1
      controller.enqueue(sseFrame(idx, event))
    },
    flush(controller) {
      console.log("[v0] sse: source closed, sending done", { runId, idx })
      controller.enqueue(sseDone())
    },
  })

  // Heartbeat — keeps the connection alive through edge proxies and signals
  // liveness to the browser during long gaps between real events.
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false
      const safeEnqueue = (chunk: Uint8Array) => {
        if (closed) return
        try {
          controller.enqueue(chunk)
        } catch {
          closed = true
        }
      }

      const heartbeat = setInterval(
        () => safeEnqueue(sseComment(`hb ${Date.now()}`)),
        15_000,
      )

      const onAbort = () => {
        console.log("[v0] sse: client aborted", { runId })
        closed = true
        clearInterval(heartbeat)
        try {
          controller.close()
        } catch {}
      }
      request.signal.addEventListener("abort", onAbort)

      const reader = source.pipeThrough(transformer).getReader()
      try {
        while (!closed) {
          const { value, done } = await reader.read()
          if (done) break
          if (value) safeEnqueue(value)
        }
      } catch (err) {
        console.error("[v0] sse: reader loop error", err)
        safeEnqueue(
          sseFrame(null, {
            type: "meta",
            message:
              err instanceof Error
                ? `stream error: ${err.message}`
                : "stream error",
          }),
        )
        safeEnqueue(sseDone())
      } finally {
        clearInterval(heartbeat)
        request.signal.removeEventListener("abort", onAbort)
        try {
          controller.close()
        } catch {}
      }
    },
  })

  return new Response(body, { headers: sseHeaders() })
}
