import { getWritable, sleep } from "workflow"
import type { UIMessageChunk } from "ai"
import {
  createDailyEmailBriefAgent,
  DAILY_EMAIL_BRIEF_KICKOFF,
} from "./agent"
import { initRun } from "./steps/init-run"
import { finalizeRun } from "./steps/finalize-run"

/**
 * Daily email brief workflow.
 *
 * The workflow is a thin orchestrator: it owns run lifecycle (sleep until
 * scheduled time, emit started / completed / failed events) and delegates
 * the actual work to the Daily Email Brief agent primitive defined in
 * `./agent.ts`. Keeping the agent in its own module means it can be reused
 * by other workflows or embedded as a sub-agent tool by another agent.
 *
 * Flow:
 *   0. (optional) sleep until `scheduledForMs` — set by the cron runner so
 *      the workflow fires at the user's local scheduled time
 *   1. initRun (step) — emits the "started" event
 *   2. Stream the Daily Email Brief agent to run:
 *        readEmails → classifyAndSummarize → persistDigest
 *   3. finalizeRun (step) — marks run completed/failed
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

  // The trigger route sets workflowRunId on the DB row after start() returns;
  // initRun just emits the "started" event for streaming clients.
  await initRun(runId)

  try {
    const agent = createDailyEmailBriefAgent({ runId, agentId })

    await agent.stream({
      messages: [{ role: "user", content: DAILY_EMAIL_BRIEF_KICKOFF }],
      writable,
      maxSteps: 8,
    })

    await finalizeRun(runId, "completed")
    return { runId, status: "completed" as const }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    await finalizeRun(runId, "failed", msg)
    throw err
  }
}
