import { getWritable, sleep } from "workflow"
import type { UIMessageChunk } from "ai"
import {
  createDailyEmailBriefAgent,
  dailyEmailBriefKickoff,
} from "./agent"
import { emitStep } from "@/lib/run-events"
import { createGwsSession } from "./sandbox/gws"
import { initRun } from "./steps/init-run"
import { finalizeRun } from "./steps/finalize-run"
import { prepareBrief } from "./steps/prepare-brief"

/**
 * Daily email brief workflow.
 *
 * Orchestrates the lifecycle around the Daily Email Brief agent:
 *
 *   0. (optional) sleep until the user's local scheduled time
 *   1. initRun (step) — emits the "started" event
 *   2. prepareBrief (step) — loads the Gmail OAuth connection, computes
 *      the since-cursor from the last completed run, and assembles the
 *      credentials blob for gws
 *   3. open a persistent sandbox with gws staged + credentials written
 *      (idempotent: first call provisions, subsequent calls resume by name)
 *   4. stream the agent — it drives gws commands directly, then calls
 *      classifyAndSummarize and persistDigest
 *   5. finalizeRun (step) — marks run completed/failed
 *   6. always close the session (snapshots the sandbox)
 */
export async function dailyEmailBrief(input: {
  runId: string
  agentId: string
  scheduledForMs?: number
}) {
  "use workflow"

  const { runId, agentId, scheduledForMs } = input

  // Cron triggers pass a future `scheduledForMs`; manual triggers do not.
  if (scheduledForMs && scheduledForMs > Date.now()) {
    await sleep(new Date(scheduledForMs))
  }

  // getWritable() is used so the Observability dashboard shows agent output.
  const writable = getWritable<UIMessageChunk>()

  await initRun(runId)

  try {
    const { afterEpoch, sinceIso, credentials } = await prepareBrief(runId)

    // Session lifecycle lives in the workflow body (not a step) because
    // the Sandbox handle is not serializable across step boundaries. The
    // underlying sandbox IS persistent-by-name via ensureAgentSandbox, so
    // if the workflow is resumed after a crash we simply reconnect to the
    // existing sandbox rather than rebuilding it.
    const session = await createGwsSession({
      agentId,
      credentials,
      onProgress: (msg) => emitStep("read", "progress", msg),
    })

    try {
      const agent = createDailyEmailBriefAgent({
        runId,
        agentId,
        session,
        afterEpoch,
        sinceIso,
      })

      await agent.stream({
        messages: [
          {
            role: "user",
            content: dailyEmailBriefKickoff(sinceIso, afterEpoch),
          },
        ],
        writable,
        // Budget: 1 list call + up to ~20 metadata fetches + classify +
        // persist + a handful of reasoning steps.
        maxSteps: 60,
      })

      await finalizeRun(runId, "completed")
      return { runId, status: "completed" as const }
    } finally {
      await session.close()
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    await finalizeRun(runId, "failed", msg)
    throw err
  }
}
