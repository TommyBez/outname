import { eq } from 'drizzle-orm'
import { connection, type NextRequest, NextResponse } from 'next/server'
import { getWorld } from 'workflow/runtime'
import { isWorkflowRunAlive, restartAgentSession } from '@/lib/agent-session'
import { db } from '@/lib/db'
import { type Agent, agent } from '@/lib/db/schema'

/**
 * Cron-driven liveness sweeper.
 *
 * Vercel Cron hits this endpoint every 15 minutes (see `vercel.json`).
 * For every enabled agent we:
 *   1. Check whether `last_session_run_id` points at a workflow that
 *      is still running; if not, start a fresh session. The fresh
 *      session reaps any orphan ticker on entry as part of its own
 *      bootstrap (see `reapOrphanTicker`).
 *   2. As a belt + suspenders, proactively cancel an orphan ticker
 *      run from this entrypoint as well, in case the new session
 *      hasn't booted yet by the time the next sweep runs.
 *
 * Why is this needed even though `agentSessionWorkflow` is durable?
 *  - A run can finish abnormally (e.g. a fatal error in the
 *    `endOfEvent` step or the ticker control plane).
 *  - A previous deployment's run may not be reachable in the new
 *    deployment's world.
 *  - A user may delete + recreate an agent across deploys; the new
 *    row starts with `last_session_run_id = NULL`.
 *
 * Idempotent: if every session is healthy and no orphan tickers
 * exist, the sweeper is a no-op. We deliberately do not delete dead
 * sessions' workflow runs; the runtime garbage-collects them on its
 * own schedule, and keeping them around aids forensic debugging via
 * the workflow dashboard.
 *
 * Authorization:
 *  - Vercel Cron requests carry an `Authorization: Bearer
 *    ${CRON_SECRET}` header. We require that header to match the
 *    `CRON_SECRET` env var so this endpoint isn't open to anyone
 *    on the internet. When `CRON_SECRET` is unset (local dev) we
 *    allow all callers — convenient for `curl` testing.
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

  const enabled = await db.select().from(agent).where(eq(agent.enabled, true))

  let restarted = 0
  let healthy = 0
  let tickersReaped = 0
  let errors = 0

  for (const a of enabled) {
    try {
      const sessionAlive =
        a.lastSessionRunId != null &&
        (await isWorkflowRunAlive(a.lastSessionRunId))

      if (!sessionAlive) {
        // The newly-started session will reap its orphan ticker on
        // entry, but we also reap here so a stalled boot can't keep
        // the orphan running between sweeps.
        if (await reapOrphanTickerForDeadSession(a)) {
          tickersReaped += 1
        }
        await restartAgentSession(a)
        restarted += 1
        continue
      }

      healthy += 1
    } catch (err) {
      errors += 1
      console.error('[v0] liveness: agent failed', a.id, err)
    }
  }

  return NextResponse.json({
    ok: true,
    enabled: enabled.length,
    healthy,
    restarted,
    tickersReaped,
    errors,
  })
}

async function reapOrphanTickerForDeadSession(a: Agent): Promise<boolean> {
  if (!a.lastTickerRunId) {
    return false
  }
  if (!(await isWorkflowRunAlive(a.lastTickerRunId))) {
    return false
  }
  try {
    const world = await getWorld()
    await world.events.create(a.lastTickerRunId, {
      eventType: 'run_cancelled',
    })
    await db
      .update(agent)
      .set({ lastTickerRunId: null, updatedAt: new Date() })
      .where(eq(agent.id, a.id))
    return true
  } catch (err) {
    console.error('[v0] liveness: reap ticker failed', a.id, err)
    return false
  }
}
