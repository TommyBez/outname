import 'server-only'
import type { AgentEvent } from '@/shared/db/schema'
import {
  getAgentEvent,
  markEventRunning,
  markEventTerminal,
} from './agent-event-store'
import { isWorkflowRunAlive, readWorkflowRunStatus } from './workflow-runs'

export const RUNNING_STALE_MS = 90 * 60_000

export async function reconcileActiveAgentEvent(
  event: AgentEvent,
  now = new Date()
): Promise<AgentEvent> {
  if (event.status === 'starting') {
    return await reconcileStartingEvent(event, now)
  }
  if (event.status === 'running') {
    return await reconcileRunningEvent(event, now)
  }
  return event
}

async function reconcileStartingEvent(event: AgentEvent): Promise<AgentEvent> {
  const alive = event.workflowRunId
    ? await isWorkflowRunAlive(event.workflowRunId)
    : false
  if (alive) {
    await markEventRunning({
      eventId: event.id,
      workflowRunId: event.workflowRunId,
    })
    return (await getAgentEvent(event.id)) ?? event
  }

  if (!event.workflowRunId) {
    return event
  }

  const status = await readWorkflowRunStatus(event.workflowRunId)
  if (status === 'not_found') {
    return await reconcileMissingWorkflowRun(event)
  }

  return event
}

async function reconcileRunningEvent(
  event: AgentEvent,
  now: Date
): Promise<AgentEvent> {
  const status = event.workflowRunId
    ? await readWorkflowRunStatus(event.workflowRunId)
    : null

  if (status === 'completed') {
    await markEventTerminal({ eventId: event.id, status: 'completed' })
    return (await getAgentEvent(event.id)) ?? event
  }
  if (status === 'failed' || status === 'cancelled') {
    await markEventTerminal({
      eventId: event.id,
      lastError: `workflow ${status}`,
      status: 'failed',
    })
    return (await getAgentEvent(event.id)) ?? event
  }
  if (status === 'not_found') {
    return await reconcileMissingWorkflowRun(event)
  }

  const heartbeatAt = event.heartbeatAt ?? event.startedAt ?? event.queuedAt
  if (now.getTime() - heartbeatAt.getTime() > RUNNING_STALE_MS) {
    await markEventTerminal({
      eventId: event.id,
      lastError: 'running event heartbeat is stale',
      status: 'failed',
    })
    return (await getAgentEvent(event.id)) ?? event
  }

  return event
}

async function reconcileMissingWorkflowRun(
  event: AgentEvent
): Promise<AgentEvent> {
  await markEventTerminal({ eventId: event.id, status: 'completed' })
  return (await getAgentEvent(event.id)) ?? event
}
