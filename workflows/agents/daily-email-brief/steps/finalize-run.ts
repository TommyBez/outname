import { eq } from "drizzle-orm"
import { revalidateTag } from "next/cache"
import { agentRunsTag, runTag, runsIndexTag } from "@/lib/cache-tags"
import { db } from "@/lib/db"
import { runs } from "@/lib/db/schema"
import { emitRun, emitStep } from "@/lib/run-events"

export async function finalizeRun(
  runId: string,
  status: "completed" | "failed",
  error?: string,
) {
  "use step"
  const [run] = await db
    .update(runs)
    .set({
      status,
      completedAt: new Date(),
      error: error ?? null,
    })
    .where(eq(runs.id, runId))
    .returning({ agentId: runs.agentId })

  if (run?.agentId) {
    revalidateTag(agentRunsTag(run.agentId), "max")
  }
  revalidateTag(runTag(runId), "max")
  revalidateTag(runsIndexTag(), "max")

  if (status === "completed") {
    await emitStep("finalize", "done", "Briefing ready")
    await emitRun("completed", "Run complete")
  } else {
    await emitStep("finalize", "error", "Run failed", { error })
    await emitRun("failed", error ?? "Run failed")
  }
  // Note: Do NOT call closeRunEvents() here - the Workflow SDK automatically
  // closes the stream when the run completes, and calling it early causes
  // 409 "stream already completed" conflicts if steps retry or emit late.
}
