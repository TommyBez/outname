import { getWritable } from 'workflow'

// Use a per-run stream namespace so concurrent chat, heartbeat, reflection,
// and invocation breadcrumbs never interleave.
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
      type: 'activity'
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

export function runEventsNamespace(runId: string): string {
  return `events:${runId}`
}

// `getWritable()` must be called from `"use step"` code.
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

export async function emitActivity(
  runId: string,
  message: string,
  meta?: Record<string, unknown>
): Promise<void> {
  await writeOne(runId, {
    type: 'activity',
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
    // Progress streaming is best-effort UI; never fail a step over breadcrumbs.
  }
}
