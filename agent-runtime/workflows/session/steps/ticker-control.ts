import { and, eq } from 'drizzle-orm'
import { getRun, resumeHook, start } from 'workflow/api'
import { getWorld } from 'workflow/runtime'
import { db } from '@/shared/db'
import { agent, user } from '@/shared/db/schema'
import { localDateKey } from '@/shared/server/timezone'
import { heartbeatAckToken, sessionToken } from '../events'
import { agentTickerWorkflow } from '../ticker'

const TERMINAL_STATUSES = new Set(['completed', 'failed', 'cancelled'])

async function isWorkflowRunAlive(workflowRunId: string): Promise<boolean> {
  try {
    const run = getRun(workflowRunId)
    const status = await run.status
    if (typeof status !== 'string') {
      return false
    }
    return !TERMINAL_STATUSES.has(status)
  } catch {
    return false
  }
}

// `start()` is step-only, and we persist the run id so later sessions or the
// liveness sweeper can reap orphaned tickers.
export async function startTicker(input: {
  agentId: string
  sessionEpoch: number
}): Promise<{ tickerRunId: string }> {
  'use step'
  const run = await start(agentTickerWorkflow, [
    { agentId: input.agentId, sessionEpoch: input.sessionEpoch },
  ])
  await db
    .update(agent)
    .set({ lastTickerRunId: run.runId, updatedAt: new Date() })
    .where(
      and(
        eq(agent.id, input.agentId),
        eq(agent.sessionEpoch, input.sessionEpoch)
      )
    )
  return { tickerRunId: run.runId }
}

export async function stopTicker(input: {
  agentId: string
  tickerRunId: string
}): Promise<void> {
  'use step'
  try {
    const world = await getWorld()
    await world.events.create(input.tickerRunId, {
      eventType: 'run_cancelled',
    })
  } catch (err) {
    console.error('[v0] stopTicker: failed to cancel ticker', err)
  }

  // Only clear the slot if it still points at this ticker so a newer session
  // cannot be clobbered by a late stop.
  try {
    await db
      .update(agent)
      .set({ lastTickerRunId: null, updatedAt: new Date() })
      .where(eq(agent.lastTickerRunId, input.tickerRunId))
  } catch (err) {
    console.error('[v0] stopTicker: failed to clear column', err)
  }
}

export async function reapOrphanTicker(input: {
  agentId: string
  sessionEpoch: number
}): Promise<{ cancelled: string | null }> {
  'use step'
  const rows = await db
    .select({ tickerRunId: agent.lastTickerRunId })
    .from(agent)
    .where(
      and(
        eq(agent.id, input.agentId),
        eq(agent.sessionEpoch, input.sessionEpoch)
      )
    )
    .limit(1)

  const prev = rows[0]?.tickerRunId ?? null
  if (!prev) {
    return { cancelled: null }
  }

  let cancelled: string | null = null
  try {
    if (await isWorkflowRunAlive(prev)) {
      const world = await getWorld()
      await world.events.create(prev, { eventType: 'run_cancelled' })
      cancelled = prev
    }
  } catch (err) {
    console.error('[v0] reapOrphanTicker: cancel failed', err)
  }

  // Clear the slot even if cancel failed; `startTicker` is about to replace it.
  try {
    await db
      .update(agent)
      .set({ lastTickerRunId: null, updatedAt: new Date() })
      .where(
        and(
          eq(agent.id, input.agentId),
          eq(agent.sessionEpoch, input.sessionEpoch)
        )
      )
  } catch (err) {
    console.error('[v0] reapOrphanTicker: clear column failed', err)
  }

  return { cancelled }
}

export interface AgentTickerSchedule {
  heartbeat: {
    enabled: boolean
    intervalMs: number
  }
  reflection: {
    due: boolean
    enabled: boolean
    intervalMs: number
    localDate: string
    timezone: string
  }
}

export async function readHeartbeatSchedule(input: {
  agentId: string
  sessionEpoch: number
}): Promise<AgentTickerSchedule> {
  'use step'
  const now = new Date()
  const rows = await db
    .select({
      heartbeatEnabled: agent.heartbeatEnabled,
      heartbeatIntervalMinutes: agent.heartbeatIntervalMinutes,
      reflectionEnabled: agent.reflectionEnabled,
      reflectionIntervalMinutes: agent.reflectionIntervalMinutes,
      lastReflectionAt: agent.lastReflectionAt,
      lastReflectionLocalDate: agent.lastReflectionLocalDate,
      sessionEpoch: agent.sessionEpoch,
      timezone: user.timezone,
    })
    .from(agent)
    .innerJoin(user, eq(agent.userId, user.id))
    .where(eq(agent.id, input.agentId))
    .limit(1)

  const row = rows[0]
  // Missing rows or epoch mismatch mean this ticker is stale, so fall back to
  // the disabled schedule instead of driving the replacement session.
  if (!row || row.sessionEpoch !== input.sessionEpoch) {
    return disabledSchedule(now)
  }

  const localDate = localDateKey(now, row.timezone)
  const reflectionIntervalMs = Math.max(
    60_000,
    row.reflectionIntervalMinutes * 60_000
  )
  const lastReflectionMs = row.lastReflectionAt?.getTime() ?? null
  const intervalElapsed =
    lastReflectionMs === null ||
    now.getTime() - lastReflectionMs >= reflectionIntervalMs
  const localDayChanged = row.lastReflectionLocalDate !== localDate
  const reflectionDue =
    row.reflectionEnabled && (intervalElapsed || localDayChanged)

  return {
    heartbeat: {
      enabled: row.heartbeatEnabled,
      intervalMs: Math.max(60_000, row.heartbeatIntervalMinutes * 60_000),
    },
    reflection: {
      due: reflectionDue,
      enabled: row.reflectionEnabled,
      intervalMs: reflectionIntervalMs,
      localDate,
      timezone: row.timezone,
    },
  }
}

function disabledSchedule(now: Date): AgentTickerSchedule {
  return {
    heartbeat: { enabled: false, intervalMs: 0 },
    reflection: {
      due: false,
      enabled: false,
      intervalMs: 0,
      localDate: localDateKey(now),
      timezone: 'UTC',
    },
  }
}

export async function pokeSessionHeartbeat(input: {
  agentId: string
  ack: string
  sessionEpoch: number
}): Promise<void> {
  'use step'
  await resumeHook(sessionToken(input.agentId, input.sessionEpoch), {
    type: 'heartbeat',
    ack: input.ack,
    mode: 'normal',
    scheduledAt: new Date().toISOString(),
  })
}

export async function pokeSessionReflection(input: {
  agentId: string
  ack: string
  localDate: string
  sessionEpoch: number
}): Promise<void> {
  'use step'
  await resumeHook(sessionToken(input.agentId, input.sessionEpoch), {
    type: 'reflection',
    ack: input.ack,
    localDate: input.localDate,
    scheduledAt: new Date().toISOString(),
  })
}

export async function ackHeartbeat(input: {
  agentId: string
  ack: string
  sessionEpoch: number
}): Promise<void> {
  'use step'
  // Missing or stale ack hooks are best-effort: the ticker may already have
  // moved on, or this event may not have been carrying an ack.
  try {
    await resumeHook(
      heartbeatAckToken(input.agentId, input.sessionEpoch, input.ack),
      { done: true }
    )
  } catch (err) {
    console.error('[v0] ackHeartbeat: resume failed', err)
  }
}
