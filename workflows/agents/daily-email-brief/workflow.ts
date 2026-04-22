import { getWritable, sleep } from "workflow"
import type { UIMessageChunk } from "ai"
import {
  shutdownAgentSandbox,
  startupAgentSandbox,
} from "@/lib/agent-sandbox"
import {
  createDailyEmailBriefAgent,
  dailyEmailBriefKickoff,
} from "./agent"
import { initRun } from "./steps/init-run"
import { finalizeRun } from "./steps/finalize-run"
import { prepareBrief } from "./steps/prepare-brief"

/**
 * Daily email brief workflow.
 *
 * Orchestrates the lifecycle around the Daily Email Brief agent:
 *
 *   0. (optional) sleep until the user's local scheduled time
 *   1. initRun — emits the "started" event
 *   2. prepareBrief — validates the Gmail OAuth connection and computes
 *      the since-cursor from the last completed run
 *   3. startupAgentSandbox — generic primitive that resumes (or boots)
 *      this agent's persistent sandbox and runs the kind-specific setup
 *      hook registered in `lib/agent-sandbox-registry.ts`
 *   4. stream the agent — it drives gws commands directly via its `gws`
 *      tool (each call is its own step that resumes the sandbox), then
 *      calls classifyAndSummarize, authors the markdown digest, and
 *      calls the generic `persistResult` tool to save it
 *   5. finalizeRun — marks run completed/failed
 *   6. shutdownAgentSandbox — generic primitive that stops the sandbox
 *      so Vercel snapshots it for the next run (always called via
 *      finally)
 *
 * The workflow body is intentionally tool-agnostic: nothing here names
 * gws, Gmail, or any binary. All tool-specific setup lives in the
 * agent-kind's `SandboxSetup`, looked up by `agent.kind` at startup.
 *
 * Note: the sandbox handle is *never* stored in the workflow body.
 * Every touch of `@vercel/sandbox` or drizzle/Neon happens inside
 * `"use step"` functions, because the workflow sandbox VM does not
 * expose `fetch`.
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
    const { afterEpoch, sinceIso } = await prepareBrief(runId)

    await startupAgentSandbox({ agentId })

    try {
      const agent = createDailyEmailBriefAgent({
        runId,
        agentId,
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
      await shutdownAgentSandbox({ agentId })
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    await finalizeRun(runId, "failed", msg)
    throw err
  }
}
