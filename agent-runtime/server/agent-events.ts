import 'server-only'
import { start } from 'workflow/api'
import { agentEventWorkflow } from '@/agent-runtime/workflows/events/workflow'
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

async function startAgentEventWorkflowRun(eventId: string): Promise<string> {
  const run = await start(agentEventWorkflow, [{ eventId }])
  return run.runId
}
