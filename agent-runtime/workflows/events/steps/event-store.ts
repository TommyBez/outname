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
  | 'workflowRunId'
>

export async function loadAgentEventStep(input: {
  eventId: string
}): Promise<WorkflowAgentEvent | null> {
  'use step'
  const { getAgentEvent } = await import(
    '@/agent-runtime/server/agent-event-store'
  )
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
    workflowRunId: event.workflowRunId,
  }
}

export async function markAgentEventRunningStep(input: {
  eventId: string
  workflowRunId?: string | null
}): Promise<void> {
  'use step'
  const { markEventRunning } = await import(
    '@/agent-runtime/server/agent-event-store'
  )
  await markEventRunning(input)
}

export async function markAgentEventHeartbeatStep(input: {
  eventId: string
}): Promise<void> {
  'use step'
  const { markEventHeartbeat } = await import(
    '@/agent-runtime/server/agent-event-store'
  )
  await markEventHeartbeat(input.eventId)
}

export async function markAgentEventTerminalStep(input: {
  eventId: string
  lastError?: string | null
  status: Extract<AgentEventStatus, 'cancelled' | 'completed' | 'failed'>
}): Promise<void> {
  'use step'
  const { markEventTerminal } = await import(
    '@/agent-runtime/server/agent-event-store'
  )
  await markEventTerminal(input)
}

export async function setAgentEventPublisherWorkflowRunIdStep(input: {
  eventId: string
  publisherWorkflowRunId: string
}): Promise<void> {
  'use step'
  const { setEventPublisherWorkflowRunId } = await import(
    '@/agent-runtime/server/agent-event-store'
  )
  await setEventPublisherWorkflowRunId(input)
}
