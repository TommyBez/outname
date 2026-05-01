import { emitRun, emitStep } from '@/lib/run-events'

export async function finalizeRun(
  runId: string,
  status: 'completed' | 'failed',
  error?: string
) {
  'use step'
  if (status === 'completed') {
    await emitStep(runId, 'finalize', 'done', 'Heartbeat complete')
    await emitRun(runId, 'completed', 'Run complete')
  } else {
    await emitStep(runId, 'finalize', 'error', 'Run failed', { error })
    await emitRun(runId, 'failed', error ?? 'Run failed')
  }
}
