import 'server-only'
import { compactLedgerEvents } from '@outname/ai/agent-runtime/shared/compact-ledger-events'
import type { AgentEventSummary } from '@outname/ai/agent-runtime/shared/event-types'
import { db } from '@outname/db'
import { type AgentEvent, agentEvents } from '@outname/db/schema'
import { and, asc, eq, getTableColumns, inArray, lte, sql } from 'drizzle-orm'
import { reconcileActiveAgentEvent } from './agent-event-reconciliation'
import {
  ACTIVE_EVENT_STATUSES,
  type AgentEventPayloads,
  listRecentAgentEvents,
  payloadAs,
} from './agent-event-store'

const PREVIEW_LIMIT = 160

export async function listAgentEventSummaries(input: {
  agentId: string
  limit?: number
  reconcileActive?: boolean
  /** When set, returns a ledger-shaped list: all live events plus this many recent terminal events per type. */
  terminalEventsPerType?: number
}): Promise<AgentEventSummary[]> {
  const [liveEvents, recentEvents] = await Promise.all([
    listLiveAgentEvents(input.agentId),
    listRecentAgentEvents({
      agentId: input.agentId,
      limit: input.limit,
    }),
  ])
  const events = mergeEvents(liveEvents, recentEvents)
  const reconciledEvents = input.reconcileActive
    ? await reconcileActiveEvents(events)
    : events
  const blockers = await findQueuedEventBlockers(reconciledEvents)
  const summaries = reconciledEvents.map((event) =>
    summarizeAgentEvent(event, blockers.get(event.id) ?? null)
  )
  if (input.terminalEventsPerType === undefined) {
    return summaries
  }
  return compactLedgerEvents(summaries, {
    terminalEventsPerType: input.terminalEventsPerType,
  })
}

/**
 * Batched variant of {@link listAgentEventSummaries} for read-only views
 * (no reconciliation): two queries for any number of agents instead of two
 * per agent, plus one shared blocker lookup.
 */
export async function listAgentEventSummariesByAgent(input: {
  agentIds: readonly string[]
  limit?: number
}): Promise<Map<string, AgentEventSummary[]>> {
  const summariesByAgent = new Map<string, AgentEventSummary[]>()
  if (input.agentIds.length === 0) {
    return summariesByAgent
  }
  const agentIds = [...input.agentIds]

  const [liveEvents, recentEvents] = await Promise.all([
    listLiveAgentEventsByAgent(agentIds),
    listRecentAgentEventsByAgent(agentIds, input.limit ?? 20),
  ])

  const eventsByAgent = new Map<string, AgentEvent[]>()
  for (const agentId of agentIds) {
    eventsByAgent.set(
      agentId,
      mergeEvents(
        liveEvents.get(agentId) ?? [],
        recentEvents.get(agentId) ?? []
      )
    )
  }

  const allEvents = [...eventsByAgent.values()].flat()
  const blockers = await findQueuedEventBlockers(allEvents)
  for (const [agentId, events] of eventsByAgent) {
    summariesByAgent.set(
      agentId,
      events.map((event) =>
        summarizeAgentEvent(event, blockers.get(event.id) ?? null)
      )
    )
  }
  return summariesByAgent
}

// Mirrors the per-agent cap of listLiveAgentEvents in the batched path.
const LIVE_EVENTS_PER_AGENT_LIMIT = 100

async function listLiveAgentEventsByAgent(
  agentIds: readonly string[]
): Promise<Map<string, AgentEvent[]>> {
  return await listRankedAgentEventsByAgent({
    agentIds,
    perAgentLimit: LIVE_EVENTS_PER_AGENT_LIMIT,
    queuedAtOrder: 'asc',
    statusFilter: inArray(agentEvents.status, [
      'queued',
      ...ACTIVE_EVENT_STATUSES,
    ]),
  })
}

async function listRecentAgentEventsByAgent(
  agentIds: readonly string[],
  limit: number
): Promise<Map<string, AgentEvent[]>> {
  return await listRankedAgentEventsByAgent({
    agentIds,
    perAgentLimit: limit,
    queuedAtOrder: 'desc',
  })
}

/**
 * Fetches up to `perAgentLimit` events per agent in a single query, using a
 * row_number window partitioned by agent so no agent can starve the others.
 */
async function listRankedAgentEventsByAgent(input: {
  agentIds: readonly string[]
  perAgentLimit: number
  queuedAtOrder: 'asc' | 'desc'
  statusFilter?: ReturnType<typeof inArray>
}): Promise<Map<string, AgentEvent[]>> {
  const agentFilter = inArray(agentEvents.agentId, [...input.agentIds])
  const orderSql =
    input.queuedAtOrder === 'asc'
      ? sql`${agentEvents.queuedAt} asc`
      : sql`${agentEvents.queuedAt} desc`
  const ranked = db.$with('ranked_agent_events').as(
    db
      .select({
        ...getTableColumns(agentEvents),
        rowNumber:
          sql<number>`row_number() over (partition by ${agentEvents.agentId} order by ${orderSql})`.as(
            'row_number'
          ),
      })
      .from(agentEvents)
      .where(
        input.statusFilter ? and(agentFilter, input.statusFilter) : agentFilter
      )
  )
  const rows = await db
    .with(ranked)
    .select()
    .from(ranked)
    .where(lte(ranked.rowNumber, input.perAgentLimit))
    .orderBy(asc(ranked.rowNumber))

  const eventsByAgent = new Map<string, AgentEvent[]>()
  for (const { rowNumber: _rowNumber, ...event } of rows) {
    const events = eventsByAgent.get(event.agentId) ?? []
    events.push(event as AgentEvent)
    eventsByAgent.set(event.agentId, events)
  }
  return eventsByAgent
}

async function reconcileActiveEvents(
  events: readonly AgentEvent[]
): Promise<AgentEvent[]> {
  return await Promise.all(
    events.map(async (event) => {
      if (event.status === 'starting' || event.status === 'running') {
        return await reconcileActiveAgentEvent(event)
      }
      return event
    })
  )
}

export function summarizeAgentEvent(
  event: AgentEvent,
  blockedByEventId: string | null = null
): AgentEventSummary {
  return {
    attempt: event.attempt,
    blockedByEventId,
    completedAt: dateToIso(event.completedAt),
    id: event.id,
    lastError: event.lastError,
    preview: previewAgentEvent(event),
    queuedAt: event.queuedAt.toISOString(),
    source: event.source,
    startedAt: dateToIso(event.startedAt),
    status: event.status,
    type: event.type,
    workflowRunId: readableWorkflowRunId(event.workflowRunId),
  }
}

async function listLiveAgentEvents(agentId: string): Promise<AgentEvent[]> {
  return await db
    .select()
    .from(agentEvents)
    .where(
      and(
        eq(agentEvents.agentId, agentId),
        inArray(agentEvents.status, ['queued', ...ACTIVE_EVENT_STATUSES])
      )
    )
    .orderBy(asc(agentEvents.queuedAt))
    .limit(100)
}

async function findQueuedEventBlockers(
  events: readonly AgentEvent[]
): Promise<Map<string, string>> {
  const concurrencyKeys = [
    ...new Set(
      events
        .filter((event) => event.status === 'queued')
        .map((event) => event.concurrencyKey)
        .filter(isString)
    ),
  ]
  if (concurrencyKeys.length === 0) {
    return new Map()
  }

  const activeEvents = await db
    .select({
      concurrencyKey: agentEvents.concurrencyKey,
      id: agentEvents.id,
    })
    .from(agentEvents)
    .where(
      and(
        inArray(agentEvents.concurrencyKey, concurrencyKeys),
        inArray(agentEvents.status, ACTIVE_EVENT_STATUSES)
      )
    )

  const activeByKey = new Map<string, string>()
  for (const event of activeEvents) {
    if (event.concurrencyKey) {
      activeByKey.set(event.concurrencyKey, event.id)
    }
  }

  const blockers = new Map<string, string>()
  for (const event of events) {
    if (event.status !== 'queued' || !event.concurrencyKey) {
      continue
    }
    const blockerId = activeByKey.get(event.concurrencyKey)
    if (blockerId && blockerId !== event.id) {
      blockers.set(event.id, blockerId)
    }
  }
  return blockers
}

function mergeEvents(
  liveEvents: readonly AgentEvent[],
  recentEvents: readonly AgentEvent[]
): AgentEvent[] {
  const byId = new Map<string, AgentEvent>()
  for (const event of [...liveEvents, ...recentEvents]) {
    byId.set(event.id, event)
  }
  return [...byId.values()]
}

function previewAgentEvent(event: AgentEvent): string | null {
  switch (event.type) {
    case 'dreaming':
      return previewScheduledEvent('Dreaming', event)
    case 'heartbeat':
      return previewScheduledEvent('Heartbeat', event)
    case 'invocation':
      return truncate(payloadAs<AgentEventPayloads['invocation']>(event).input)
    default: {
      const exhaustive: never = event.type
      return exhaustive
    }
  }
}

function previewScheduledEvent(label: string, event: AgentEvent): string {
  const source = event.source === 'manual' ? 'manual' : event.source
  return `${label} ${source}`
}

function readableWorkflowRunId(workflowRunId: string | null): string | null {
  if (!(workflowRunId && !workflowRunId.startsWith('starting:'))) {
    return null
  }
  return workflowRunId
}

function truncate(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  if (!trimmed) {
    return null
  }
  return trimmed.length > PREVIEW_LIMIT
    ? `${trimmed.slice(0, PREVIEW_LIMIT - 3)}...`
    : trimmed
}

function dateToIso(value: Date | null): string | null {
  return value?.toISOString() ?? null
}

function isString(value: string | null): value is string {
  return typeof value === 'string' && value.length > 0
}
