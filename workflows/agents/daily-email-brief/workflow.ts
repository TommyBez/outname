import { getWritable, sleep } from "workflow"
import type { UIMessageChunk } from "ai"
import {
  createDailyEmailBriefAgent,
  dailyEmailBriefKickoff,
} from "./agent"
import { closeGws, installGws } from "./sandbox/gws"
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
 *   3. installGws (step) — ensures the persistent sandbox exists, stages
 *      the gws binary, and writes per-run credentials
 *   4. stream the agent — it drives gws commands directly via the `gws`
 *      tool (each call is its own step that resumes the sandbox), then
 *      calls classifyAndSummarize and persistDigest
 *   5. finalizeRun (step) — marks run completed/failed
 *   6. closeGws (step) — always called, stops the sandbox so Vercel
 *      snapshots it for the next run
 *
 * Note: the sandbox handle is *never* stored in the workflow body. Every
 * touch of `@vercel/sandbox` or drizzle/Neon happens inside `"use step"`
 * functions, because the workflow sandbox VM does not expose `fetch`.
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

    await installGws({ agentId, credentials })

    try {
      const agent = createDailyEmailBriefAgent({
        runId,
        agentId,
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
      await closeGws(agentId)
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    await finalizeRun(runId, "failed", msg)
    throw err
  }
}
