import 'server-only'
import { agentEventWorkflow } from '@outname/ai/agent-runtime/workflows/agent-events/workflow'
import { start } from '@outname/workflow/api'
import type {
  EnqueueAgentEventInput,
  EnqueueAgentEventResult,
} from './agent-event-start'
import {
  enqueueAgentEventWithStarter,
  tryStartAgentEventWithStarter,
} from './agent-event-start'

export type {
  EnqueueAgentEventInput,
  EnqueueAgentEventResult,
} from './agent-event-start'

export async function enqueueAgentEvent(
  input: EnqueueAgentEventInput
): Promise<EnqueueAgentEventResult> {
  return await enqueueAgentEventWithStarter(input, startAgentEventWorkflowRun)
}

export async function tryStartAgentEvent(
  eventId: string
): Promise<string | null> {
  return await tryStartAgentEventWithStarter(
    eventId,
    startAgentEventWorkflowRun
  )
}

export async function startAgentEventWorkflowRun(
  eventId: string
): Promise<string> {
  const run = await start(agentEventWorkflow, [{ eventId }])
  return run.runId
}
