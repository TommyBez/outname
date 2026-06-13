import type { AgentEvent, AgentEventStatus } from '@outname/db/schema'

export type WorkflowAgentEvent = Pick<
  AgentEvent,
  | 'agentId'
  | 'concurrencyKey'
  | 'id'
  | 'payload'
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
  const { getAgentEvent } = await import(
    '@outname/ai/agent-runtime/server/agent-event-store'
  )
  const event = await getAgentEvent(input.eventId)
  if (!event) {
    return null
  }
  const {
    agentId,
    concurrencyKey,
    id,
    payload,
    source,
    status,
    type,
    userId,
    workflowRunId,
  } = event
  return {
    agentId,
    concurrencyKey,
    id,
    payload,
    source,
    status,
    type,
    userId,
    workflowRunId,
  }
}

export async function markAgentEventRunningStep(input: {
  eventId: string
  workflowRunId?: string | null
}): Promise<void> {
  'use step'
  const { markEventRunning } = await import(
    '@outname/ai/agent-runtime/server/agent-event-store'
  )
  await markEventRunning(input)
}

export async function markAgentEventHeartbeatStep(input: {
  eventId: string
}): Promise<void> {
  'use step'
  const { markEventHeartbeat } = await import(
    '@outname/ai/agent-runtime/server/agent-event-store'
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
    '@outname/ai/agent-runtime/server/agent-event-store'
  )
  await markEventTerminal(input)
}
