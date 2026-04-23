import { db } from "@/lib/db"
import { runResult } from "@/lib/db/schema"
import { emitStep } from "@/lib/run-events"

/**
 * Agent-agnostic result persistence.
 *
 * Every agent — regardless of what it does — produces a single textual
 * output per run. This step writes that text (markdown by convention)
 * plus optional agent-defined `metrics` to the `run_result` table in a
 * single atomic insert. Lookups are always by `runId`.
 *
 * The step knows nothing about categories, Gmail, or any other
 * agent-specific data shape: the agent renders whatever markdown it
 * wants and calls this once per run.
 */
export async function persistRunResult(
  runId: string,
  content: string,
  metrics?: Record<string, unknown>,
): Promise<{ runId: string; bytes: number }> {
  "use step"

  await emitStep("persist", "start", "Saving result")

  await db.insert(runResult).values({ runId, content, metrics })

  await emitStep("persist", "done", "Result saved", {
    bytes: content.length,
    ...(metrics ?? {}),
  })

  return { runId, bytes: content.length }
}
