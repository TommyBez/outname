import {
  type StartAgentEventWorkflowRun,
  startNextQueuedForConcurrencyKeyWithStarter,
} from '@outname/ai/agent-runtime/server/agent-event-start'

export async function startNextQueuedEventForWorkflow(input: {
  concurrencyKey: string | null
  startWorkflowRun: StartAgentEventWorkflowRun
}): Promise<void> {
  if (!input.concurrencyKey) {
    return
  }

  await startNextQueuedForConcurrencyKeyWithStarter(
    input.concurrencyKey,
    input.startWorkflowRun
  )
}
