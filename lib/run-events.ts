import { getWritable } from "workflow"

/**
 * Typed progress events written from workflow steps to a per-run stream
 * (namespace: "events"). Consumed by the client via SSE to render a live
 * timeline while the workflow executes.
 */
export type RunStepName = "read" | "classify" | "persist" | "finalize"

export type RunEvent =
  | {
      type: "step"
      step: RunStepName
      status: "start" | "progress" | "done" | "error"
      message: string
      meta?: Record<string, unknown>
      ts: number
    }
  | {
      type: "run"
      status: "started" | "completed" | "failed"
      message: string
      meta?: Record<string, unknown>
      ts: number
    }

type EmitInput = Omit<Extract<RunEvent, { type: "step" }>, "ts" | "type"> | Omit<Extract<RunEvent, { type: "run" }>, "ts" | "type">

/** Fire-and-forget-safe emit. Must only be called inside a `"use step"` function. */
export async function emitStep(
  step: RunStepName,
  status: "start" | "progress" | "done" | "error",
  message: string,
  meta?: Record<string, unknown>,
): Promise<void> {
  await writeOne({ type: "step", step, status, message, meta, ts: Date.now() })
}

export async function emitRun(
  status: "started" | "completed" | "failed",
  message: string,
  meta?: Record<string, unknown>,
): Promise<void> {
  await writeOne({ type: "run", status, message, meta, ts: Date.now() })
}

async function writeOne(event: RunEvent): Promise<void> {
  try {
    const writable = getWritable<RunEvent>({ namespace: "events" })
    const writer = writable.getWriter()
    try {
      await writer.write(event)
    } finally {
      writer.releaseLock()
    }
  } catch (err) {
    // Streaming is best-effort progress UI — never fail a step because we
    // couldn't write a breadcrumb. Surface the error in logs so silent
    // streaming bugs are diagnosable.
    console.error("[v0] emit event failed", err)
  }
}

/** Close the per-run event stream so clients receive a clean EOF. */
export async function closeRunEvents(): Promise<void> {
  try {
    await getWritable<RunEvent>({ namespace: "events" }).close()
  } catch (err) {
    console.error("[v0] close events stream failed", err)
  }
}

// Avoid unused import lint if emitInput type isn't referenced downstream.
export type { EmitInput }
