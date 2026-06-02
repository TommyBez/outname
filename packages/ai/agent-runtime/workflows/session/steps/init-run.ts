import { emitRun } from '@outname/ai/agent-runtime/server/run-events'

/**
 * Marks a heartbeat/dreaming event as started by emitting the canonical
 * `"started"` event onto its workflow-scoped stream namespace.
 */
export async function initRun(runId: string) {
  'use step'
  await emitRun(runId, 'started', 'Run started', { runId })
  return { runId }
}
