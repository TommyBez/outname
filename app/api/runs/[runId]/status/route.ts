import { NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { revalidateTag } from "next/cache"
import { getRun } from "workflow/api"
import { agentRunsTag, runTag, runsIndexTag } from "@/lib/cache-tags"
import { db } from "@/lib/db"
import { runs } from "@/lib/db/schema"
import { requireSession } from "@/lib/auth-guard"

export async function GET(_req: Request, { params }: { params: Promise<{ runId: string }> }) {
  await requireSession()
  const { runId } = await params

  const [row] = await db.select().from(runs).where(eq(runs.id, runId)).limit(1)
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 })

  let finalStatus = row.status
  let finalError = row.error
  let finalCompletedAt = row.completedAt
  let liveStatus: string | null = null

  // Reconcile with Workflow runtime if we have a handle and DB says "running".
  // This protects against cases where finalizeRun never ran (e.g., sandbox
  // died mid-catch) so the UI never shows "Running" forever.
  if (row.workflowRunId && row.status === "running") {
    try {
      const r = getRun(row.workflowRunId)
      const s = await r.status
      liveStatus = typeof s === "string" ? s : ((s as any)?.state ?? null)

      if (liveStatus === "failed" || liveStatus === "completed") {
        const completedAt = new Date()
        const reconciled: "completed" | "failed" =
          liveStatus === "failed" ? "failed" : "completed"
        const errorMsg =
          reconciled === "failed"
            ? (row.error ??
              "Workflow reported failure but no error was persisted. Check Vercel logs.")
            : null

        await db
          .update(runs)
          .set({ status: reconciled, completedAt, error: errorMsg })
          .where(eq(runs.id, row.id))

        if (row.agentId) {
          revalidateTag(agentRunsTag(row.agentId), "max")
        }
        revalidateTag(runTag(row.id), "max")
        revalidateTag(runsIndexTag(), "max")

        finalStatus = reconciled
        finalError = errorMsg
        finalCompletedAt = completedAt
      }
    } catch (err) {
      // The DB can be shared by local, preview, and production. A workflow
      // run that is not visible from this runtime may still be alive in
      // another environment, so this endpoint must not reconcile it.
      liveStatus =
        err instanceof Error && err.name === "WorkflowRunNotFoundError"
          ? "unavailable"
          : null
    }
  }

  return NextResponse.json({
    runId: row.id,
    workflowRunId: row.workflowRunId,
    status: finalStatus,
    liveStatus,
    startedAt: row.startedAt,
    completedAt: finalCompletedAt,
    error: finalError,
  })
}
