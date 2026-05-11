import { and, eq } from 'drizzle-orm'
import { getRun, resumeHook, start } from 'workflow/api'
import { getWorld } from 'workflow/runtime'
import { db } from '@/shared/db'
import { agent, user } from '@/shared/db/schema'
import { localDateKey } from '@/shared/server/timezone'
import { heartbeatAckToken, sessionToken } from '../events'
import { agentTickerWorkflow } from '../ticker'

const TERMINAL_STATUSES = new Set(['completed', 'failed', 'cancelled'])

/**
 * Local copy of the alive check used by `lib/agent-session.ts`. Inlined
 * here to break the circular import between `lib/agent-session` and
 * the session workflow's step modules. Kept tiny so it stays in sync
 * by inspection.
 */
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

/**
 * Start the sibling ticker workflow that drives this agent's heartbeat
 * loop. Returns the ticker workflow's runtime id so the session can
 * cancel it from its `finally` block.
 *
 * The runtime id is also persisted onto the agent row so a session
 * that crashes without entering its `finally` block leaves a forensic
 * record we can reap (a) at the start of the next session and (b) via
 * the cron liveness sweeper.
 *
 * Always called from inside the session workflow via a `"use step"`
 * boundary because `start()` is a step-only API.
 */
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

/**
 * Cancel the ticker workflow and clear the tracking column. Best-effort:
 * a missing or already-stopped ticker is not an error — we always
 * recreate one on session restart. The DB column is cleared regardless
 * of cancel outcome, since the value only exists to find orphan runs
 * and the runtime treats already-terminal runs as a no-op cancel.
 */
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

  // Clear the column only when this is still the row's current ticker —
  // a racing newer session may have written a different id between our
  // read and write windows, and we do not want to clobber it.
  try {
    await db
      .update(agent)
      .set({ lastTickerRunId: null, updatedAt: new Date() })
      .where(eq(agent.lastTickerRunId, input.tickerRunId))
  } catch (err) {
    console.error('[v0] stopTicker: failed to clear column', err)
  }
}

/**
 * Reap an orphan ticker that survived a previous session crash. Called
 * from `agentSessionWorkflow` on entry, before starting a fresh ticker.
 *
 * Reads the agent row, checks whether `last_ticker_run_id` points at a
 * still-alive workflow run, and cancels it if so. The column is
 * cleared regardless so a subsequent `startTicker` writes a clean
 * value.
 */
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

  // Clear the slot unconditionally — `startTicker` is about to write a
  // fresh value over the top.
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

/**
 * Read the agent's current heartbeat schedule (`heartbeat_enabled` +
 * `heartbeat_interval_minutes`). Called at the top of every ticker
 * iteration so a UI toggle / interval change is picked up without
 * restarting the session.
 *
 * Returns a fallback `{ enabled: false, intervalMs: 0 }` if the agent
 * row has been deleted underneath us — the ticker treats that as a
 * paused agent and will keep idling at the disabled-poll cadence
 * until the cron sweeper notices the row is gone.
 */
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

/**
 * Push a heartbeat event into the session's hook. Called by
 * `agentTickerWorkflow` once per tick; the `ack` token is used by the
 * session to release the ticker after the handler completes.
 */
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

/**
 * Resume the per-tick ack hook so the ticker can move on to its next
 * sleep interval. Called from the session workflow's heartbeat handler
 * once `handleHeartbeat` returns.
 *
 * Tolerant of conflicts: a stale ack (ticker already moved on, or the
 * ack hook never existed because the heartbeat was a one-shot trigger
 * push without an `ack` field) is logged and swallowed.
 */
export async function ackHeartbeat(input: {
  agentId: string
  ack: string
  sessionEpoch: number
}): Promise<void> {
  'use step'
  try {
    await resumeHook(
      heartbeatAckToken(input.agentId, input.sessionEpoch, input.ack),
      { done: true }
    )
  } catch (err) {
    console.error('[v0] ackHeartbeat: resume failed', err)
  }
}
