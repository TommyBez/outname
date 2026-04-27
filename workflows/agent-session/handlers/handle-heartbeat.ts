import { getWritable } from "workflow"
import { FatalError } from "workflow"
import type { UIMessageChunk } from "ai"
import { startupAgentSandbox } from "@/lib/agent-sandbox"
import type { AgentKind } from "@/lib/db/schema"
import {
  createDailyEmailBriefAgent,
  dailyEmailBriefKickoff,
} from "@/workflows/agents/daily-email-brief/agent"
import { initRun } from "@/workflows/agents/daily-email-brief/steps/init-run"
import { prepareBrief } from "@/workflows/agents/daily-email-brief/steps/prepare-brief"
import { finalizeRun } from "@/workflows/agents/daily-email-brief/steps/finalize-run"
import { beginHeartbeatRun } from "../steps/begin-heartbeat-run"

/**
 * Heartbeat event handler — runs inside the long-lived session
 * workflow once per ticker tick (or once per "Trigger now" press).
 *
 * Replicates the lifecycle of the deleted `dailyEmailBrief` workflow,
 * one-to-one, so `runs` rows continue to look the same to the existing
 * `/runs` UI:
 *
 *   1. `beginHeartbeatRun` — insert the runs row, return its id.
 *   2. `initRun` — emit the canonical `started` event onto
 *      `events:${runId}`.
 *   3. `prepareBrief` — validate the Gmail OAuth and compute the
 *      since-cursor.
 *   4. `startupAgentSandbox` — resume the agent's persistent sandbox.
 *      The session loop will snapshot it via `endOfEvent` after we
 *      return.
 *   5. Stream the `DurableAgent` against the kickoff prompt. The agent
 *      drives gws calls itself, runs `classifyAndSummarize`, authors
 *      the markdown digest, and calls `persistResult`.
 *   6. `finalizeRun` — flip the runs row to `completed` (or `failed`).
 *
 * Errors are caught and converted to a failed `runs` row before
 * re-throwing so the session loop can surface them via its outer
 * try/catch without losing the run-level breadcrumb.
 *
 * Phase 1 hardcodes the kind dispatch to `daily-email-brief` because
 * it is the only kind today. Phase 2 generalises this — every kind's
 * heartbeat will go through the agent factory exposed via the runtime
 * registry, with the kickoff message coming from per-kind config.
 */
export async function handleHeartbeat(input: {
  agentId: string
  kind: AgentKind
}): Promise<void> {
  const { agentId, kind } = input

  // Per-run namespace — the run's progress events live here. Distinct
  // from the chat per-turn namespace so the two flows never collide on
  // the session workflow's stream graph.
  const { runId } = await beginHeartbeatRun({ agentId })

  const writable = getWritable<UIMessageChunk>({
    namespace: `heartbeat:${runId}`,
  })

  try {
    await initRun(runId)

    if (kind !== "daily-email-brief") {
      throw new FatalError(
        `Heartbeat for kind "${kind}" is not implemented yet.`,
      )
    }

    const { afterEpoch, sinceIso } = await prepareBrief(runId)

    await startupAgentSandbox({ agentId })

    // Build the agent against this heartbeat's runId so persistResult
    // and emitStep land on the right `events:${runId}` namespace. The
    // `kind !== "daily-email-brief"` guard above narrows this branch,
    // so we can call the factory directly. Phase 2 routes through the
    // runtime registry once additional kinds exist.
    const agent = createDailyEmailBriefAgent({ runId, agentId })

    await agent.stream({
      messages: [
        {
          role: "user",
          content: dailyEmailBriefKickoff(sinceIso, afterEpoch),
        },
      ],
      writable,
      maxSteps: 60,
    })

    await finalizeRun(runId, "completed")
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await finalizeRun(runId, "failed", message)
    throw err
  }
}
