import { emitRun, emitStep } from '@/agent-runtime/server/run-events'

export async function finalizeRun(
  runId: string,
  status: 'completed' | 'failed',
  detail?: string
) {
  'use step'
  if (status === 'completed') {
    await emitStep(runId, 'finalize', 'done', detail ?? 'Heartbeat complete')
    await emitRun(runId, 'completed', detail ?? 'Run complete')
  } else {
    await emitStep(runId, 'finalize', 'error', 'Run failed', { error: detail })
    await emitRun(runId, 'failed', detail ?? 'Run failed')
  }
}
