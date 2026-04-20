import { eq } from "drizzle-orm"
import { getRun } from "workflow/api"
import { requireSession } from "@/lib/auth-guard"
import { db } from "@/lib/db"
import { runs } from "@/lib/db/schema"
import type { RunEvent } from "@/lib/run-events"

const encoder = new TextEncoder()

type ClientFrame = RunEvent | { type: "meta"; message: string }

function sseLine(id: number | null, event: ClientFrame): Uint8Array {
  const idLine = id === null ? "" : `id: ${id}\n`
  return encoder.encode(`${idLine}event: message\ndata: ${JSON.stringify(event)}\n\n`)
}

function sseDone(): Uint8Array {
  return encoder.encode(`event: done\ndata: {}\n\n`)
}

function sseHeartbeat(): Uint8Array {
  // SSE comment — keeps proxies from buffering and the connection alive.
  return encoder.encode(`: heartbeat ${Date.now()}\n\n`)
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

function sseHeaders(): HeadersInit {
  return {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    // Disable any proxy buffering so events arrive promptly.
    "X-Accel-Buffering": "no",
  }
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
  // On first connect (no Last-Event-ID) we replay the ENTIRE stream from 0.
  // On reconnect, resume just after the last event the client acknowledged.
  const startIndex = Number.isFinite(parsedStart) ? parsedStart + 1 : 0

  // Terminal state — the run already finished or never acquired a workflow id.
  if (!workflowRunId || row.status === "completed" || row.status === "failed") {
    const terminal: ClientFrame =
      row.status === "failed"
        ? {
            type: "run",
            status: "failed",
            message: row.error ?? "Run failed before workflow started",
            ts: Date.now(),
          }
        : row.status === "completed"
          ? {
              type: "run",
              status: "completed",
              message: "Run complete",
              ts: Date.now(),
            }
          : { type: "meta", message: "Workflow starting..." }

    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(sseLine(0, terminal))
        controller.enqueue(sseDone())
        controller.close()
      },
    })
    return new Response(stream, { headers: sseHeaders() })
  }

  // Live run — pipe the workflow's namespaced stream to the client as SSE.
  const stream = new ReadableStream<Uint8Array>({
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

      // 1) Immediate connected frame so the client can stop showing "Starting…"
      safeEnqueue(
        sseLine(null, {
          type: "meta",
          message: "Stream connected",
        }),
      )

      // 2) Keep-alive heartbeat — prevents proxy timeouts and edge buffering.
      const heartbeat = setInterval(() => safeEnqueue(sseHeartbeat()), 15_000)

      // 3) Abort cleanly if the client disconnects.
      const abort = () => {
        closed = true
        clearInterval(heartbeat)
        try {
          controller.close()
        } catch {
          // already closed
        }
      }
      request.signal.addEventListener("abort", abort)

      // 4) Pipe the workflow event stream.
      let idx = startIndex
      try {
        const source = getRun(workflowRunId).getReadable<RunEvent>({
          namespace: "events",
          startIndex,
        })
        const reader = source.getReader()
        while (!closed) {
          const { value, done } = await reader.read()
          if (done) break
          if (value) {
            safeEnqueue(sseLine(idx, value))
            idx += 1
          }
        }
      } catch (err) {
        console.error("[v0] sse stream error", err)
        safeEnqueue(
          sseLine(null, {
            type: "meta",
            message:
              err instanceof Error ? `stream error: ${err.message}` : "stream error",
          }),
        )
      } finally {
        clearInterval(heartbeat)
        safeEnqueue(sseDone())
        try {
          controller.close()
        } catch {
          // already closed
        }
      }
    },
  })

  return new Response(stream, { headers: sseHeaders() })
}
