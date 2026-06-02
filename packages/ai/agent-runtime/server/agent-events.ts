import 'server-only'
import { startAgentEventWorkflowRun } from '@outname/ai/agent-runtime/workflows/agent-events/starter'
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
