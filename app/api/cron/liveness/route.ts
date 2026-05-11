import { eq } from 'drizzle-orm'
import { connection, type NextRequest, NextResponse } from 'next/server'
import { isWorkflowRunAlive } from '@/agent-runtime/server/session-lifecycle'
import { recoverAgentSession } from '@/agent-runtime/server/session-recovery'
import { db } from '@/shared/db'
import { type Agent, agent } from '@/shared/db/schema'

interface LivenessCounters {
  errors: number
  healthy: number
  recoveryErrors: number
  recoverySkipped: number
  restarted: number
  stalledRecovered: number
  tickersReaped: number
}

// Vercel Cron periodically checks each enabled agent and safely recovers dead
// or stalled session runs. The sweep is idempotent, keeps workflow history for
// forensics, and is gated by `CRON_SECRET` / `LIVENESS_CRON_ENABLED`.
export async function GET(req: NextRequest) {
  // Force request-time execution so Next does not try to prerender a route
  // that needs runtime env vars like `DATABASE_URL`.
  await connection()

  const expected = process.env.CRON_SECRET
  if (expected) {
    const got = req.headers.get('authorization')
    if (got !== `Bearer ${expected}`) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }
  }

  if (process.env.LIVENESS_CRON_ENABLED !== 'true') {
    return NextResponse.json({ ok: true, skipped: 'liveness cron disabled' })
  }

  const enabled = await db.select().from(agent).where(eq(agent.enabled, true))
  const counters: LivenessCounters = {
    errors: 0,
    healthy: 0,
    recoveryErrors: 0,
    recoverySkipped: 0,
    restarted: 0,
    stalledRecovered: 0,
    tickersReaped: 0,
  }
  const now = new Date()

  for (const a of enabled) {
    try {
      await sweepAgent(a, counters, now)
    } catch (err) {
      counters.errors += 1
      console.error('[v0] liveness: agent failed', a.id, err)
    }
  }

  return NextResponse.json({
    ok: true,
    enabled: enabled.length,
    ...counters,
  })
}

async function sweepAgent(
  a: Agent,
  counters: LivenessCounters,
  now: Date
): Promise<void> {
  const sessionAlive =
    a.lastSessionRunId != null && (await isWorkflowRunAlive(a.lastSessionRunId))

  if (!sessionAlive) {
    await recoverDeadSession(a, counters)
    return
  }

  if (shouldRecoverStalledSession(a, now)) {
    await recoverStalledSession(a, counters)
    return
  }

  counters.healthy += 1
}

async function recoverDeadSession(
  a: Agent,
  counters: LivenessCounters
): Promise<void> {
  const recovery = await recoverAgentSession({
    agentId: a.id,
    mode: 'safe',
    reason: 'dead_session',
  })

  if (recovery.recovered) {
    counters.restarted += 1
    countTickerReap(recovery.previousTickerRunId, counters)
    return
  }

  countUnrecoveredSession(recovery.reason, counters)
}

async function recoverStalledSession(
  a: Agent,
  counters: LivenessCounters
): Promise<void> {
  const recovery = await recoverAgentSession({
    agentId: a.id,
    mode: 'safe',
    reason: 'session_event_stall',
  })

  if (recovery.recovered) {
    counters.stalledRecovered += 1
    countTickerReap(recovery.previousTickerRunId, counters)
    return
  }

  countUnrecoveredSession(recovery.reason, counters)
}

function countTickerReap(
  previousTickerRunId: string | null,
  counters: LivenessCounters
): void {
  if (previousTickerRunId) {
    counters.tickersReaped += 1
  }
}

function countUnrecoveredSession(
  reason: string,
  counters: LivenessCounters
): void {
  if (reason === 'recovery_already_in_progress') {
    counters.recoverySkipped += 1
    return
  }

  counters.recoveryErrors += 1
}

function shouldRecoverStalledSession(a: Agent, now: Date): boolean {
  if (process.env.LIVENESS_AUTO_RECOVERY_ENABLED === 'false') {
    return false
  }

  const lastSessionRunId = a.lastSessionRunId
  const markerRunId = a.sessionEventRunId
  const startedAt = a.sessionEventStartedAt

  if (!(lastSessionRunId && markerRunId && startedAt)) {
    return false
  }

  if (markerRunId !== lastSessionRunId) {
    return false
  }

  const stalledMs =
    readNonNegativeIntegerEnv(process.env.LIVENESS_EVENT_STALL_MINUTES, 120) *
    60_000

  return now.getTime() - startedAt.getTime() > stalledMs
}

function readNonNegativeIntegerEnv(
  value: string | undefined,
  fallback: number
): number {
  if (!value) {
    return fallback
  }

  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}
