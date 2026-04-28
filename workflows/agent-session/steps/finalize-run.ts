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
    await emitStep(runId, "finalize", "done", "Heartbeat complete")
    await emitRun(runId, "completed", "Run complete")
  } else {
    await emitStep(runId, "finalize", "error", "Run failed", { error })
    await emitRun(runId, "failed", error ?? "Run failed")
  }
}
