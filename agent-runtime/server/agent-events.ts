import 'server-only'
import type {
  EnqueueAgentEventInput,
  EnqueueAgentEventResult,
} from './agent-event-start'
import {
  enqueueAgentEventWithStarter,
  tryStartAgentEventWithStarter,
} from './agent-event-start'
import { startAgentEventWorkflowRun } from './agent-event-workflow-starter'

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
