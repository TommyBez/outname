import { getWritable } from 'workflow'

/**
 * Typed progress events written from workflow steps to a per-run stream.
 *
 * The session workflow handles many short-lived events (chat,
 * heartbeat, reflection, invocation). Writing all breadcrumbs into a
 * shared `events` namespace would interleave unrelated progress.
 *
 * Every emit takes the workflow/runtime event id and writes to
 * `events:${runId}`.
 */
export type RunStepName = 'read' | 'classify' | 'persist' | 'finalize'

export type RunEvent =
  | {
      type: 'step'
      step: RunStepName
      status: 'start' | 'progress' | 'done' | 'error'
      message: string
      meta?: Record<string, unknown>
      ts: number
    }
  | {
      type: 'run'
      status: 'started' | 'completed' | 'failed'
      message: string
      meta?: Record<string, unknown>
      ts: number
    }

/**
 * Stream namespace for a single workflow/runtime event.
 */
export function runEventsNamespace(runId: string): string {
  return `events:${runId}`
}

/** Fire-and-forget-safe step event. Must only be called inside a `"use step"` function. */
export async function emitStep(
  runId: string,
  step: RunStepName,
  status: 'start' | 'progress' | 'done' | 'error',
  message: string,
  meta?: Record<string, unknown>
): Promise<void> {
  await writeOne(runId, {
    type: 'step',
    step,
    status,
    message,
    meta,
    ts: Date.now(),
  })
}

export async function emitRun(
  runId: string,
  status: 'started' | 'completed' | 'failed',
  message: string,
  meta?: Record<string, unknown>
): Promise<void> {
  await writeOne(runId, {
    type: 'run',
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
