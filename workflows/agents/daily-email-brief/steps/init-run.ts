import { emitRun } from "@/lib/run-events"

export async function initRun(runId: string) {
  "use step"
  // NOTE: workflowRunId is set by the trigger route AFTER start() returns.
  // Do NOT set it here - the workflow body doesn't know its own runtime ID
  // and setting it to the wrong value breaks the /stream endpoint which
  // uses workflowRunId to call getRun().getReadable().
  await emitRun("started", "Run started", { runId })
  return { runId }
}
