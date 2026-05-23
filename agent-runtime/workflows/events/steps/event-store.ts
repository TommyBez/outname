import {
  getAgentEvent,
  markEventHeartbeat,
  markEventRunning,
  markEventTerminal,
  setEventPublisherWorkflowRunId,
} from '@/agent-runtime/server/agent-event-store'
import type { AgentEvent, AgentEventStatus } from '@/shared/db/schema'

export type WorkflowAgentEvent = Pick<
  AgentEvent,
  | 'agentId'
  | 'concurrencyKey'
  | 'id'
  | 'payload'
  | 'publisherWorkflowRunId'
  | 'source'
  | 'status'
  | 'type'
  | 'userId'
  | 'workflowRunId'
>

export async function loadAgentEventStep(input: {
  eventId: string
}): Promise<WorkflowAgentEvent | null> {
  'use step'
  const event = await getAgentEvent(input.eventId)
  if (!event) {
    return null
  }
  return {
    agentId: event.agentId,
    concurrencyKey: event.concurrencyKey,
    id: event.id,
    payload: event.payload,
    publisherWorkflowRunId: event.publisherWorkflowRunId,
    source: event.source,
    status: event.status,
    type: event.type,
    userId: event.userId,
    workflowRunId: event.workflowRunId,
  }
}

export async function markAgentEventRunningStep(input: {
  eventId: string
  workflowRunId?: string | null
}): Promise<void> {
  'use step'
  await markEventRunning(input)
}

export async function markAgentEventHeartbeatStep(input: {
  eventId: string
}): Promise<void> {
  'use step'
  await markEventHeartbeat(input.eventId)
}

export async function markAgentEventTerminalStep(input: {
  eventId: string
  lastError?: string | null
  status: Extract<AgentEventStatus, 'cancelled' | 'completed' | 'failed'>
}): Promise<void> {
  'use step'
  await markEventTerminal(input)
}

export async function setAgentEventPublisherWorkflowRunIdStep(input: {
  eventId: string
  publisherWorkflowRunId: string
}): Promise<void> {
  'use step'
  await setEventPublisherWorkflowRunId(input)
}
