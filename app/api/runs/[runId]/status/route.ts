import { NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { getRun } from "workflow/api"
import { db } from "@/lib/db"
import { runs } from "@/lib/db/schema"
import { requireSession } from "@/lib/auth-guard"

export async function GET(_req: Request, { params }: { params: Promise<{ runId: string }> }) {
  await requireSession()
  const { runId } = await params

  const [row] = await db.select().from(runs).where(eq(runs.id, runId)).limit(1)
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 })

  // Live status from Workflow runtime (when we have a workflow_run_id)
  let liveStatus: string | null = null
  if (row.workflowRunId) {
    try {
      const r = getRun(row.workflowRunId)
      const s = await r.status
      liveStatus = typeof s === "string" ? s : (s as any)?.state ?? null
    } catch {
      liveStatus = null
    }
  }

  return NextResponse.json({
    runId: row.id,
    workflowRunId: row.workflowRunId,
    status: row.status,
    liveStatus,
    startedAt: row.startedAt,
    completedAt: row.completedAt,
    emailsScanned: row.emailsScanned,
    error: row.error,
  })
}
