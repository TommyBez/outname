import { NextResponse, type NextRequest } from "next/server"
import { start } from "workflow/api"
import { eq } from "drizzle-orm"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { runs } from "@/lib/db/schema"
import { dailyInboxReview } from "@/workflows/daily-inbox-review"

function nanoid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

async function isAuthorized(req: NextRequest) {
  // Allow cron calls via CRON_SECRET bearer
  const cronSecret = process.env.CRON_SECRET
  const authHeader = req.headers.get("authorization")
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) return "cron" as const

  // Otherwise require a logged-in session
  const session = await auth.api.getSession({ headers: await headers() })
  if (session) return "manual" as const
  return null
}

export async function POST(req: NextRequest) {
  const trigger = await isAuthorized(req)
  if (!trigger) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const runId = nanoid()

  // Create the DB row FIRST so the UI can immediately poll.
  await db.insert(runs).values({
    id: runId,
    status: "running",
    trigger,
    startedAt: new Date(),
  })

  try {
    const run = await start(dailyInboxReview, [runId])
    await db
      .update(runs)
      .set({ workflowRunId: run.runId })
      .where(eq(runs.id, runId))

    return NextResponse.json({ runId, workflowRunId: run.runId })
  } catch (err) {
    await db
      .update(runs)
      .set({
        status: "failed",
        completedAt: new Date(),
        error: err instanceof Error ? err.message : String(err),
      })
      .where(eq(runs.id, runId))
    return NextResponse.json({ error: "failed to start workflow" }, { status: 500 })
  }
}

// Vercel Cron hits GET — forward to POST logic.
export async function GET(req: NextRequest) {
  return POST(req)
}
