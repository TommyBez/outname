import 'server-only'
import { eq } from 'drizzle-orm'
import {
  scheduledBucketKey,
  scheduledConcurrencyKey,
  scheduledDailyKey,
} from '@/agent-runtime/server/agent-event-keys'
import {
  listExpiredStartingEvents,
  listQueuedEvents,
  listRunningEvents,
  markEventRunning,
  markEventTerminal,
  resetStartingEvent,
} from '@/agent-runtime/server/agent-event-store'
import {
  enqueueAgentEvent,
  tryStartAgentEvent,
} from '@/agent-runtime/server/agent-events'
import {
  isWorkflowRunAlive,
  readWorkflowRunStatus,
} from '@/agent-runtime/server/workflow-runs'
import { normalizeAgentScheduleMode } from '@/shared/agent-schedule'
import { db } from '@/shared/db'
import { agent, user } from '@/shared/db/schema'
import { localDateKey } from '@/shared/server/timezone'
import { resolveDailyScheduleDue } from './schedule-due'

const RUNNING_STALE_MS = 90 * 60_000

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
      timezone: row.timezone,
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
    const alive = event.workflowRunId
      ? await isWorkflowRunAlive(event.workflowRunId)
      : false
    if (alive) {
      await markEventRunning({
        eventId: event.id,
        workflowRunId: event.workflowRunId,
      })
      continue
    }
    await resetStartingEvent({
      eventId: event.id,
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
    const status = event.workflowRunId
      ? await readWorkflowRunStatus(event.workflowRunId)
      : null
    if (status === 'completed') {
      await markEventTerminal({ eventId: event.id, status: 'completed' })
      counters.completedRecovered += 1
      continue
    }
    if (status === 'failed' || status === 'cancelled') {
      await markEventTerminal({
        eventId: event.id,
        lastError: `workflow ${status}`,
        status: 'failed',
      })
      counters.failedRecovered += 1
      continue
    }
    if (status === 'not_found') {
      await markEventTerminal({
        eventId: event.id,
        lastError: 'workflow run not found',
        status: 'failed',
      })
      counters.failedRecovered += 1
      continue
    }

    const heartbeatAt = event.heartbeatAt ?? event.startedAt ?? event.queuedAt
    if (now.getTime() - heartbeatAt.getTime() > RUNNING_STALE_MS) {
      await markEventTerminal({
        eventId: event.id,
        lastError: 'running event heartbeat is stale',
        status: 'failed',
      })
      counters.runningStaleFailed += 1
      continue
    }
    counters.runningHealthy += 1
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
  timezone: string
}): ScheduledDue | null {
  const a = input.agent
  if (!a.dreamingEnabled) {
    return null
  }
  if (normalizeAgentScheduleMode(a.dreamingScheduleMode) === 'daily_times') {
    const due = resolveDailyScheduleDue({
      lastRunAt: a.lastDreamingAt,
      now: input.now,
      times: a.dreamingScheduleTimes,
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
        type: 'dreaming',
      }),
      localDate: due.localDate,
      scheduledFor: due.scheduledFor,
    }
  }

  const intervalElapsed =
    !a.lastDreamingAt ||
    input.now.getTime() - a.lastDreamingAt.getTime() >=
      a.dreamingIntervalMinutes * 60_000
  if (!(intervalElapsed || a.lastDreamingLocalDate !== input.localDate)) {
    return null
  }
  return {
    key: scheduledBucketKey({
      agentId: a.id,
      intervalMinutes: a.dreamingIntervalMinutes,
      now: input.now,
      type: 'dreaming',
    }),
    localDate: input.localDate,
    scheduledFor: input.now,
  }
}
