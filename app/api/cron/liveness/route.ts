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

/**
 * Cron-driven liveness sweeper.
 *
 * Vercel Cron hits this endpoint every 15 minutes (see `vercel.json`).
 * For every enabled agent we:
 *   1. Check whether `last_session_run_id` points at a workflow that
 *      is still running; if not, recover it through the shared session
 *      control plane.
 *   2. If the session is alive but its current event marker has been
 *      open too long, run conservative safe recovery.
 *
 * Why is this needed even though `agentSessionWorkflow` is durable?
 *  - A run can finish abnormally (e.g. a fatal error in the
 *    `endOfEvent` step or the ticker control plane).
 *  - A previous deployment's run may not be reachable in the new
 *    deployment's world.
 *  - A user may delete + recreate an agent across deploys; the new
 *    row starts with `last_session_run_id = NULL`.
 *
 * Idempotent: if every session is healthy, the sweeper is a no-op. We
 * deliberately do not delete dead sessions' workflow runs; the runtime
 * garbage-collects them on its own schedule, and keeping them around
 * aids forensic debugging via the workflow dashboard.
 *
 * Authorization:
 *  - Vercel Cron requests carry an `Authorization: Bearer
 *    ${CRON_SECRET}` header. We require that header to match the
 *    `CRON_SECRET` env var so this endpoint isn't open to anyone
 *    on the internet. When `CRON_SECRET` is unset (local dev) we
 *    allow all callers — convenient for `curl` testing.
 *  - If `LIVENESS_CRON_ENABLED` is not `true`, returns early with
 *    `{ ok: true, skipped }` — no agent queries or restarts.
 */
export async function GET(req: NextRequest) {
  // Cache Components is on for this project. Calling `connection()`
  // at the top of the handler tells Next that everything below
  // requires the request, so the build pipeline does not try to
  // prerender the route — which would otherwise fail because env
  // vars like DATABASE_URL aren't populated at build time.
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
