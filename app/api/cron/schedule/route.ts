import { NextResponse, type NextRequest } from "next/server"
import { and, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { agent, userSettings } from "@/lib/db/schema"
import { nextScheduledRun, schedulesFireToday } from "@/lib/scheduling"
import { startAgentRun } from "@/lib/start-agent-run"

/**
 * Daily scheduler. Hit by Vercel Cron once at the start of each UTC day.
 * For every enabled agent whose schedule fires today in the user's timezone,
 * we start a workflow run that immediately sleeps until the user-local
 * scheduled time, then proceeds.
 *
 * This is idempotent per agent per day: if a run has already been scheduled
 * for today, we skip it. Skipped detection lives here (not inside the
 * workflow) so cron retries don't double-schedule.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  const authHeader = req.headers.get("authorization")
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const now = new Date()
  const enabled = await db.select().from(agent).where(eq(agent.enabled, true))

  const scheduled: { agentId: string; runId: string; scheduledFor: string }[] = []
  const skipped: { agentId: string; reason: string }[] = []

  for (const a of enabled) {
    const [settings] = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, a.userId))
      .limit(1)
    const tz = settings?.timezone ?? "UTC"

    if (!schedulesFireToday({ now, tz, scheduleDays: a.scheduleDays })) {
      skipped.push({ agentId: a.id, reason: "not-today" })
      continue
    }

    const next = nextScheduledRun({
      from: now,
      tz,
      time: a.scheduleTime,
      scheduleDays: a.scheduleDays,
    })
    if (!next) {
      skipped.push({ agentId: a.id, reason: "no-next-slot" })
      continue
    }

    try {
      const { runId } = await startAgentRun({
        agent: a,
        trigger: "cron",
        scheduledFor: next,
      })
      scheduled.push({
        agentId: a.id,
        runId,
        scheduledFor: next.toISOString(),
      })
    } catch (err) {
      skipped.push({
        agentId: a.id,
        reason: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return NextResponse.json({ scheduled, skipped, now: now.toISOString() })
}
