import 'server-only'
import { db } from '@outname/db'
import {
  type Agent,
  type AgentEventSource,
  type AgentEventType,
  agentEvents,
} from '@outname/db/schema'
import { nanoid } from 'nanoid'
import { replyNamespaceForEvent } from './agent-event-keys'
import {
  claimQueuedEvent,
  findNextQueuedForConcurrencyKey,
  getAgentEvent,
  getAgentEventByIdempotencyKey,
  resetStartingEvent,
  setEventWorkflowRunId,
} from './agent-event-store'

const EVENT_CLAIM_TTL_MS = 5 * 60_000

export interface EnqueueAgentEventInput {
  agent: Agent
  concurrencyKey?: string | null
  idempotencyKey: string
  payload: Record<string, unknown>
  scheduledFor?: Date | null
  source: AgentEventSource
  startImmediately?: boolean
  type: AgentEventType
}

export interface EnqueueAgentEventResult {
  event: typeof agentEvents.$inferSelect
  eventId: string
  replyNamespace: string
  workflowRunId: string | null
}

export type StartAgentEventWorkflowRun = (eventId: string) => Promise<string>

export async function enqueueAgentEventWithStarter(
  input: EnqueueAgentEventInput,
  startWorkflowRun: StartAgentEventWorkflowRun
): Promise<EnqueueAgentEventResult> {
  const eventId = `evt_${nanoid(16)}`
  const inserted = await db
    .insert(agentEvents)
    .values({
      id: eventId,
      agentId: input.agent.id,
      userId: input.agent.userId,
      type: input.type,
      source: input.source,
      status: 'queued',
      idempotencyKey: input.idempotencyKey,
      concurrencyKey: input.concurrencyKey ?? null,
      payload: input.payload,
      scheduledFor: input.scheduledFor ?? null,
    })
    .onConflictDoNothing()
    .returning()

  const event =
    inserted[0] ?? (await getAgentEventByIdempotencyKey(input.idempotencyKey))
  if (!event) {
    throw new Error('enqueueAgentEvent: event missing after insert')
  }

  const workflowRunId =
    input.startImmediately === false
      ? null
      : await tryStartAgentEventWithStarter(event.id, startWorkflowRun)

  return {
    event,
    eventId: event.id,
    replyNamespace: replyNamespaceForEvent(event.id),
    workflowRunId,
  }
}

export async function tryStartAgentEventWithStarter(
  eventId: string,
  startWorkflowRun: StartAgentEventWorkflowRun
): Promise<string | null> {
  const event = await getAgentEvent(eventId)
  if (!event) {
    return null
  }
  if (event.status !== 'queued') {
    return realWorkflowRunId(event.workflowRunId)
  }
  if (event.scheduledFor && event.scheduledFor.getTime() > Date.now()) {
    return null
  }

  const claimed = await claimQueuedEvent(
    event,
    `starting:${event.id}`,
    new Date(Date.now() + EVENT_CLAIM_TTL_MS)
  )

  if (!claimed) {
    return null
  }

  try {
    const runId = await startWorkflowRun(event.id)
    await setEventWorkflowRunId({ eventId: event.id, workflowRunId: runId })
    return runId
  } catch (err) {
    await resetStartingEvent({
      eventId: event.id,
      error: err instanceof Error ? err.message : String(err),
    })
    throw err
  }
}

export async function startNextQueuedForConcurrencyKeyWithStarter(
  concurrencyKey: string | null,
  startWorkflowRun: StartAgentEventWorkflowRun
): Promise<string | null> {
  if (!concurrencyKey) {
    return null
  }
  const next = await findNextQueuedForConcurrencyKey(concurrencyKey)
  return next
    ? await tryStartAgentEventWithStarter(next.id, startWorkflowRun)
    : null
}

function realWorkflowRunId(workflowRunId: string | null): string | null {
  if (!workflowRunId || workflowRunId.startsWith('starting:')) {
    return null
  }
  return workflowRunId
}
