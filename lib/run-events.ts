import { getWritable } from "workflow"

/**
 * Typed progress events written from workflow steps to a per-run stream.
 *
 * Phase 1 introduces a single long-lived `agentSessionWorkflow` per
 * agent that handles many short-lived "runs" (heartbeats) on the same
 * workflow run id. Writing all of those into a shared `events`
 * namespace would interleave breadcrumbs across runs and break the
 * `/runs/:runId/stream` UI.
 *
 * To keep the existing UI byte-compatible, every emit now takes the
 * internal `runId` and writes to `events:${runId}`. The
 * `/runs/:runId/stream` route reads from the same namespace and falls
 * back to the legacy `events` namespace for runs created before the
 * refactor.
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

/**
 * Stream namespace for a single internal run. Older runs (created
 * before the session workflow landed) still live on the legacy `events`
 * namespace; the stream route handles both.
 */
export function runEventsNamespace(runId: string): string {
  return `events:${runId}`
}

/** Fire-and-forget-safe step event. Must only be called inside a `"use step"` function. */
export async function emitStep(
  runId: string,
  step: RunStepName,
  status: "start" | "progress" | "done" | "error",
  message: string,
  meta?: Record<string, unknown>,
): Promise<void> {
  await writeOne(runId, {
    type: "step",
    step,
    status,
    message,
    meta,
    ts: Date.now(),
  })
}

export async function emitRun(
  runId: string,
  status: "started" | "completed" | "failed",
  message: string,
  meta?: Record<string, unknown>,
): Promise<void> {
  await writeOne(runId, {
    type: "run",
    status,
    message,
    meta,
    ts: Date.now(),
  })
}

async function writeOne(runId: string, event: RunEvent): Promise<void> {
  try {
    const writable = getWritable<RunEvent>({
      namespace: runEventsNamespace(runId),
    })
    const writer = writable.getWriter()
    try {
      await writer.write(event)
    } finally {
      writer.releaseLock()
    }
  } catch {
    // Streaming is best-effort progress UI - never fail a step because we
    // couldn't write a breadcrumb.
  }
}
