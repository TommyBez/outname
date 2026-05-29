import 'server-only'
import { db } from '@outname/db'
import {
  type AgentEvent,
  type AgentEventStatus,
  agentEvents,
} from '@outname/db/schema'
import { and, asc, desc, eq, inArray, isNull, lt, lte, or } from 'drizzle-orm'

export const ACTIVE_EVENT_STATUSES = ['starting', 'running'] as const
export const TERMINAL_EVENT_STATUSES = [
  'completed',
  'failed',
  'cancelled',
] as const

export interface AgentEventPayloads {
  dreaming: {
    localDate: string
    manual?: boolean
    scheduledAt: string
  }
  heartbeat: {
    manual?: boolean
    scheduledAt: string
  }
  invocation: {
    callStack: string[]
    depth: number
    input: string
    parentRunId?: string | null
    parentToolCallId?: string | null
    parentToolId?: string | null
    streamToken: string
  }
}

export async function getAgentEvent(
  eventId: string
): Promise<AgentEvent | null> {
  const [row] = await db
    .select()
    .from(agentEvents)
    .where(eq(agentEvents.id, eventId))
    .limit(1)
  return row ?? null
}

export async function getAgentEventByIdempotencyKey(
  idempotencyKey: string
): Promise<AgentEvent | null> {
  const [row] = await db
    .select()
    .from(agentEvents)
    .where(eq(agentEvents.idempotencyKey, idempotencyKey))
    .limit(1)
  return row ?? null
}

export async function hasActiveConcurrencyEvent(input: {
  concurrencyKey: string
  excludeEventId?: string
}): Promise<boolean> {
  const rows = await db
    .select({ id: agentEvents.id })
    .from(agentEvents)
    .where(
      and(
        eq(agentEvents.concurrencyKey, input.concurrencyKey),
        inArray(agentEvents.status, ACTIVE_EVENT_STATUSES)
      )
    )
    .limit(5)
  return rows.some((row) => row.id !== input.excludeEventId)
}

export async function claimQueuedEvent(
  event: AgentEvent,
  workflowRunId: string,
  claimExpiresAt: Date
): Promise<AgentEvent | null> {
  if (event.concurrencyKey) {
    await requeueExpiredStartingEventsForConcurrencyKey({
      concurrencyKey: event.concurrencyKey,
      now: new Date(),
    })
  }

  const active = event.concurrencyKey
    ? await hasActiveConcurrencyEvent({
        concurrencyKey: event.concurrencyKey,
        excludeEventId: event.id,
      })
    : false
  if (active) {
    return null
  }

  try {
    const [claimed] = await db
      .update(agentEvents)
      .set({
        attempt: event.attempt + 1,
        claimExpiresAt,
        lastError: null,
        startedAt: new Date(),
        status: 'starting',
        updatedAt: new Date(),
        workflowRunId,
      })
      .where(
        and(eq(agentEvents.id, event.id), eq(agentEvents.status, 'queued'))
      )
      .returning()
    return claimed ?? null
  } catch (err) {
    if (isPgUniqueViolation(err)) {
      return null
    }
    throw err
  }
}

export async function markEventRunning(input: {
  eventId: string
  workflowRunId?: string | null
}): Promise<void> {
  await db
    .update(agentEvents)
    .set({
      claimExpiresAt: null,
      heartbeatAt: new Date(),
      startedAt: new Date(),
      status: 'running',
      updatedAt: new Date(),
      workflowRunId: input.workflowRunId ?? undefined,
    })
    .where(
      and(
        eq(agentEvents.id, input.eventId),
        inArray(agentEvents.status, ['starting', 'running'])
      )
    )
}

export async function setEventWorkflowRunId(input: {
  eventId: string
  workflowRunId: string
}): Promise<void> {
  await db
    .update(agentEvents)
    .set({ updatedAt: new Date(), workflowRunId: input.workflowRunId })
    .where(eq(agentEvents.id, input.eventId))
}

export async function setEventPublisherWorkflowRunId(input: {
  eventId: string
  publisherWorkflowRunId: string
}): Promise<void> {
  await db
    .update(agentEvents)
    .set({
      publisherWorkflowRunId: input.publisherWorkflowRunId,
      updatedAt: new Date(),
    })
    .where(eq(agentEvents.id, input.eventId))
}

export async function markEventHeartbeat(eventId: string): Promise<void> {
  await db
    .update(agentEvents)
    .set({ heartbeatAt: new Date(), updatedAt: new Date() })
    .where(eq(agentEvents.id, eventId))
}

export async function markEventTerminal(input: {
  eventId: string
  lastError?: string | null
  status: Extract<AgentEventStatus, 'cancelled' | 'completed' | 'failed'>
}): Promise<void> {
  await db
    .update(agentEvents)
    .set({
      claimExpiresAt: null,
      completedAt: new Date(),
      heartbeatAt: new Date(),
      lastError: input.lastError ?? null,
      status: input.status,
      updatedAt: new Date(),
    })
    .where(eq(agentEvents.id, input.eventId))
}

export async function resetStartingEvent(input: {
  eventId: string
  error: string
}): Promise<void> {
  await db
    .update(agentEvents)
    .set({
      claimExpiresAt: null,
      lastError: input.error,
      status: 'queued',
      updatedAt: new Date(),
      workflowRunId: null,
    })
    .where(eq(agentEvents.id, input.eventId))
}

export async function requeueExpiredStartingEventsForConcurrencyKey(input: {
  concurrencyKey: string
  now: Date
}): Promise<void> {
  await db
    .update(agentEvents)
    .set({
      claimExpiresAt: null,
      lastError: 'starting claim expired before next event claim',
      status: 'queued',
      updatedAt: new Date(),
      workflowRunId: null,
    })
    .where(
      and(
        eq(agentEvents.concurrencyKey, input.concurrencyKey),
        eq(agentEvents.status, 'starting'),
        lt(agentEvents.claimExpiresAt, input.now)
      )
    )
}

export async function listQueuedEvents(
  limit = 50,
  now = new Date()
): Promise<AgentEvent[]> {
  return await db
    .select()
    .from(agentEvents)
    .where(
      and(
        eq(agentEvents.status, 'queued'),
        or(isNull(agentEvents.scheduledFor), lte(agentEvents.scheduledFor, now))
      )
    )
    .orderBy(asc(agentEvents.queuedAt))
    .limit(limit)
}

export async function listExpiredStartingEvents(
  now: Date
): Promise<AgentEvent[]> {
  return await db
    .select()
    .from(agentEvents)
    .where(
      and(
        eq(agentEvents.status, 'starting'),
        or(
          isNull(agentEvents.claimExpiresAt),
          lt(agentEvents.claimExpiresAt, now)
        )
      )
    )
    .orderBy(asc(agentEvents.queuedAt))
    .limit(50)
}

export async function listRunningEvents(): Promise<AgentEvent[]> {
  return await db
    .select()
    .from(agentEvents)
    .where(eq(agentEvents.status, 'running'))
    .orderBy(asc(agentEvents.startedAt))
    .limit(100)
}

export async function listRecentAgentEvents(input: {
  agentId: string
  limit?: number
}): Promise<AgentEvent[]> {
  return await db
    .select()
    .from(agentEvents)
    .where(eq(agentEvents.agentId, input.agentId))
    .orderBy(desc(agentEvents.queuedAt))
    .limit(input.limit ?? 20)
}

export async function findNextQueuedForConcurrencyKey(
  concurrencyKey: string,
  now = new Date()
): Promise<AgentEvent | null> {
  const [row] = await db
    .select()
    .from(agentEvents)
    .where(
      and(
        eq(agentEvents.concurrencyKey, concurrencyKey),
        eq(agentEvents.status, 'queued'),
        or(isNull(agentEvents.scheduledFor), lte(agentEvents.scheduledFor, now))
      )
    )
    .orderBy(asc(agentEvents.queuedAt))
    .limit(1)
  return row ?? null
}

export function payloadAs<T>(event: AgentEvent): T {
  return event.payload as T
}

function isPgUniqueViolation(error: unknown): boolean {
  let current = error
  while (current && typeof current === 'object') {
    if ((current as { code?: unknown }).code === '23505') {
      return true
    }
    current = (current as { cause?: unknown }).cause
  }
  return false
}
