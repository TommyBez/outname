import { NextResponse, type NextRequest } from "next/server"
import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { agent } from "@/lib/db/schema"
import {
  isWorkflowRunAlive,
  restartAgentSession,
} from "@/lib/agent-session"

/**
 * Cron-driven liveness sweeper.
 *
 * Vercel Cron hits this endpoint every 15 minutes (see `vercel.json`).
 * For every enabled agent we check whether `last_session_run_id`
 * points at a workflow that is still running; if not, we start a
 * fresh session.
 *
 * Why is this needed even though `agentSessionWorkflow` is durable?
 *  - A run can finish abnormally (e.g. a fatal error in the
 *    `endOfEvent` step or the ticker control plane).
 *  - A previous deployment's run may not be reachable in the new
 *    deployment's world.
 *  - A user may delete + recreate an agent across deploys; the new
 *    row starts with `last_session_run_id = NULL`.
 *
 * The sweeper is idempotent: if every session is healthy it does
 * nothing. We deliberately do not delete dead sessions' workflow
 * runs; the runtime garbage-collects them on its own schedule, and
 * keeping them around aids forensic debugging via the workflow
 * dashboard.
 *
 * Authorization:
 *  - Vercel Cron requests carry an `Authorization: Bearer
 *    ${CRON_SECRET}` header. We require that header to match the
 *    `CRON_SECRET` env var so this endpoint isn't open to anyone
 *    on the internet. When `CRON_SECRET` is unset (local dev) we
 *    allow all callers — convenient for `curl` testing.
 */
export async function GET(req: NextRequest) {
  const expected = process.env.CRON_SECRET
  if (expected) {
    const got = req.headers.get("authorization")
    if (got !== `Bearer ${expected}`) {
      return NextResponse.json(
        { error: "unauthorized" },
        { status: 401 },
      )
    }
  }

  const enabled = await db
    .select()
    .from(agent)
    .where(eq(agent.enabled, true))

  let restarted = 0
  let healthy = 0
  let errors = 0

  for (const a of enabled) {
    try {
      const alive =
        a.lastSessionRunId != null &&
        (await isWorkflowRunAlive(a.lastSessionRunId))
      if (alive) {
        healthy += 1
        continue
      }
      await restartAgentSession(a)
      restarted += 1
    } catch (err) {
      errors += 1
      console.error("[v0] liveness: agent failed", a.id, err)
    }
  }

  return NextResponse.json({
    ok: true,
    enabled: enabled.length,
    healthy,
    restarted,
    errors,
  })
}
