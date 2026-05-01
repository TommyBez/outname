import { emitRun } from '@/lib/run-events'

/**
 * Marks a heartbeat/reflection event as started by emitting the canonical
 * `"started"` event onto its workflow-scoped stream namespace.
 */
export async function initRun(runId: string) {
  'use step'
  await emitRun(runId, 'started', 'Run started', { runId })
  return { runId }
}
