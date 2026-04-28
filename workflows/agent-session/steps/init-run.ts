import { emitRun } from "@/lib/run-events"

/**
 * Marks a heartbeat-driven run as started by emitting the canonical
 * `"started"` event onto its per-run stream namespace. The runs row is
 * inserted by the heartbeat handler before this step runs (see
 * `workflows/agent-session/steps/begin-heartbeat-run.ts`).
 */
export async function initRun(runId: string) {
  "use step"
  await emitRun(runId, "started", "Run started", { runId })
  return { runId }
}
