import 'server-only'
import { eq } from 'drizzle-orm'
import {
  scheduledConcurrencyKey,
  scheduledDailyKey,
} from '@/agent-runtime/server/agent-event-keys'
import { reconcileActiveAgentEvent } from '@/agent-runtime/server/agent-event-reconciliation'
import {
  listExpiredStartingEvents,
  listQueuedEvents,
  listRunningEvents,
  resetStartingEvent,
} from '@/agent-runtime/server/agent-event-store'
import {
  enqueueAgentEvent,
  tryStartAgentEvent,
} from '@/agent-runtime/server/agent-events'
import { isWorkflowRunAlive } from '@/agent-runtime/server/workflow-runs'
import { normalizeAgentScheduleMode } from '@/shared/agent-schedule'
import { db } from '@/shared/db/pool'
import { agent, user } from '@/shared/db/schema'
import { localDateKey } from '@/shared/server/timezone'
import { resolveDailyScheduleDue } from './schedule-due'

export interface SchedulerCounters {
  completedRecovered: number
  dueDreaming: number
  dueHeartbeat: number
  failedRecovered: number
  queuedStarted: number
  runningHealthy: number
  runningStaleFailed: number
  startingRequeued: number
}

export async function runAgentEventScheduler(now = new Date()) {
  const counters: SchedulerCounters = {
    completedRecovered: 0,
    dueDreaming: 0,
    dueHeartbeat: 0,
    failedRecovered: 0,
    queuedStarted: 0,
    runningHealthy: 0,
    runningStaleFailed: 0,
    startingRequeued: 0,
  }

  await enqueueDueScheduledEvents(now, counters)
  await recoverExpiredStartingEvents(now, counters)
  await recoverRunningEvents(now, counters)
  await startQueuedEvents(now, counters)

  return counters
}

async function enqueueDueScheduledEvents(
  now: Date,
  counters: SchedulerCounters
): Promise<void> {
  const rows = await db
    .select({
      agent,
      timezone: user.timezone,
    })
    .from(agent)
    .innerJoin(user, eq(agent.userId, user.id))
    .where(eq(agent.enabled, true))

  for (const row of rows) {
    const a = row.agent
    const heartbeatDue = resolveHeartbeatDue({
      agent: a,
      now,
      timezone: row.timezone,
    })
    if (heartbeatDue) {
      await enqueueAgentEvent({
        agent: a,
        concurrencyKey: heartbeatDue.key,
        idempotencyKey: heartbeatDue.key,
        payload: { scheduledAt: heartbeatDue.scheduledFor.toISOString() },
        scheduledFor: heartbeatDue.scheduledFor,
        source: 'scheduler',
        type: 'heartbeat',
      })
      counters.dueHeartbeat += 1
    }

    const localDate = localDateKey(now, row.timezone)
    const dreamingDue = resolveDreamingDue({
      agent: a,
      localDate,
      now,
    })
    if (dreamingDue) {
      await enqueueAgentEvent({
        agent: a,
        concurrencyKey: dreamingDue.key,
        idempotencyKey: dreamingDue.key,
        payload: {
          localDate: dreamingDue.localDate,
          scheduledAt: dreamingDue.scheduledFor.toISOString(),
        },
        scheduledFor: dreamingDue.scheduledFor,
        source: 'scheduler',
        type: 'dreaming',
      })
      counters.dueDreaming += 1
    }
  }
}

async function recoverExpiredStartingEvents(
  now: Date,
  counters: SchedulerCounters
): Promise<void> {
  const events = await listExpiredStartingEvents(now)
  for (const event of events) {
    const reconciled = await reconcileActiveAgentEvent(event, now)
    if (reconciled.status !== 'starting') {
      continue
    }
    const alive = reconciled.workflowRunId
      ? await isWorkflowRunAlive(reconciled.workflowRunId)
      : false
    if (alive) {
      continue
    }
    await resetStartingEvent({
      eventId: reconciled.id,
      error: 'starting claim expired before workflow became healthy',
    })
    counters.startingRequeued += 1
  }
}

async function recoverRunningEvents(
  now: Date,
  counters: SchedulerCounters
): Promise<void> {
  const events = await listRunningEvents()
  for (const event of events) {
    const beforeStatus = event.status
    const beforeError = event.lastError
    const reconciled = await reconcileActiveAgentEvent(event, now)
    if (
      reconciled.status === beforeStatus &&
      reconciled.lastError === beforeError
    ) {
      counters.runningHealthy += 1
      continue
    }
    if (reconciled.status === 'completed') {
      counters.completedRecovered += 1
      continue
    }
    if (reconciled.status === 'failed') {
      if (reconciled.lastError === 'running event heartbeat is stale') {
        counters.runningStaleFailed += 1
      } else {
        counters.failedRecovered += 1
      }
    }
  }
}

async function startQueuedEvents(
  now: Date,
  counters: SchedulerCounters
): Promise<void> {
  const events = await listQueuedEvents(100, now)
  for (const event of events) {
    const runId = await tryStartAgentEvent(event.id)
    if (runId) {
      counters.queuedStarted += 1
    }
  }
}

interface ScheduledDue {
  key: string
  localDate: string
  scheduledFor: Date
}

function resolveHeartbeatDue(input: {
  agent: typeof agent.$inferSelect
  now: Date
  timezone: string
}): ScheduledDue | null {
  const a = input.agent
  if (!a.heartbeatEnabled) {
    return null
  }
  if (normalizeAgentScheduleMode(a.heartbeatScheduleMode) === 'daily_times') {
    const due = resolveDailyScheduleDue({
      lastRunAt: a.lastHeartbeatAt,
      now: input.now,
      times: a.heartbeatScheduleTimes,
      timezone: input.timezone,
    })
    if (!due) {
      return null
    }
    return {
      key: scheduledDailyKey({
        agentId: a.id,
        localDate: due.localDate,
        time: due.time,
        type: 'heartbeat',
      }),
      localDate: due.localDate,
      scheduledFor: due.scheduledFor,
    }
  }

  if (
    a.lastHeartbeatAt &&
    input.now.getTime() - a.lastHeartbeatAt.getTime() <
      a.heartbeatIntervalMinutes * 60_000
  ) {
    return null
  }
  return {
    key: scheduledConcurrencyKey({
      agentId: a.id,
      intervalMinutes: a.heartbeatIntervalMinutes,
      now: input.now,
      type: 'heartbeat',
    }),
    localDate: localDateKey(input.now, input.timezone),
    scheduledFor: input.now,
  }
}

function resolveDreamingDue(input: {
  agent: typeof agent.$inferSelect
  localDate: string
  now: Date
}): ScheduledDue | null {
  const a = input.agent
  if (!a.dreamingEnabled) {
    return null
  }
  if (a.lastDreamingLocalDate === input.localDate) {
    return null
  }
  return {
    key: scheduledDailyKey({
      agentId: a.id,
      localDate: input.localDate,
      time: '00:00',
      type: 'dreaming',
    }),
    localDate: input.localDate,
    scheduledFor: input.now,
  }
}
