import 'server-only'
import type { AgentEvent } from '@outname/db/schema'
import {
  getAgentEvent,
  markEventRunning,
  markEventTerminal,
} from './agent-event-store'
import { readableAgentEventWorkflowRunId } from './agent-event-workflow-run-id'
import { isWorkflowRunAlive, readWorkflowRunStatus } from './workflow-runs'

export const RUNNING_STALE_MS = 90 * 60_000
export type ReconcileActiveAgentEventOutcome =
  | 'unchanged'
  | 'completed'
  | 'failed-stale'
  | 'failed-workflow'

export interface ReconcileActiveAgentEventResult {
  event: AgentEvent
  outcome: ReconcileActiveAgentEventOutcome
}

export async function reconcileActiveAgentEvent(
  event: AgentEvent,
  now = new Date()
): Promise<AgentEvent> {
  return (await reconcileActiveAgentEventWithOutcome(event, now)).event
}

export async function reconcileActiveAgentEventWithOutcome(
  event: AgentEvent,
  now = new Date()
): Promise<ReconcileActiveAgentEventResult> {
  if (event.status === 'starting') {
    return await reconcileStartingEvent(event)
  }
  if (event.status === 'running') {
    return await reconcileRunningEvent(event, now)
  }
  return { event, outcome: 'unchanged' }
}

async function reconcileStartingEvent(
  event: AgentEvent
): Promise<ReconcileActiveAgentEventResult> {
  const workflowRunId = readableAgentEventWorkflowRunId(event.workflowRunId)
  const alive = workflowRunId ? await isWorkflowRunAlive(workflowRunId) : false
  if (alive) {
    await markEventRunning({
      eventId: event.id,
      workflowRunId,
    })
    return {
      event: (await getAgentEvent(event.id)) ?? event,
      outcome: 'unchanged',
    }
  }

  if (!workflowRunId) {
    return { event, outcome: 'unchanged' }
  }

  const status = await readWorkflowRunStatus(workflowRunId)
  const reconciled = await reconcileKnownWorkflowStatus(event, status)
  if (reconciled) {
    return reconciled
  }

  return { event, outcome: 'unchanged' }
}

async function reconcileRunningEvent(
  event: AgentEvent,
  now: Date
): Promise<ReconcileActiveAgentEventResult> {
  const workflowRunId = readableAgentEventWorkflowRunId(event.workflowRunId)
  const status = workflowRunId
    ? await readWorkflowRunStatus(workflowRunId)
    : null

  const reconciled = await reconcileKnownWorkflowStatus(event, status)
  if (reconciled) {
    return reconciled
  }

  const heartbeatAt = event.heartbeatAt ?? event.startedAt ?? event.queuedAt
  if (now.getTime() - heartbeatAt.getTime() > RUNNING_STALE_MS) {
    await markEventTerminal({
      eventId: event.id,
      lastError: 'running event heartbeat is stale',
      status: 'failed',
    })
    return {
      event: (await getAgentEvent(event.id)) ?? event,
      outcome: 'failed-stale',
    }
  }

  return { event, outcome: 'unchanged' }
}

async function reconcileKnownWorkflowStatus(
  event: AgentEvent,
  status: string | null
): Promise<ReconcileActiveAgentEventResult | null> {
  if (status === 'completed') {
    await markEventTerminal({ eventId: event.id, status: 'completed' })
    return {
      event: (await getAgentEvent(event.id)) ?? event,
      outcome: 'completed',
    }
  }
  if (status === 'failed' || status === 'cancelled') {
    await markEventTerminal({
      eventId: event.id,
      lastError: `workflow ${status}`,
      status: 'failed',
    })
    return {
      event: (await getAgentEvent(event.id)) ?? event,
      outcome: 'failed-workflow',
    }
  }
  if (status === 'not_found') {
    return await reconcileMissingWorkflowRun(event)
  }
  return null
}

async function reconcileMissingWorkflowRun(
  event: AgentEvent
): Promise<ReconcileActiveAgentEventResult> {
  await markEventTerminal({ eventId: event.id, status: 'completed' })
  return {
    event: (await getAgentEvent(event.id)) ?? event,
    outcome: 'completed',
  }
}
