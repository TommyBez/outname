import { resumeHook, start } from "workflow/api"
import { getWorld } from "workflow/runtime"
import { agentTickerWorkflow } from "../ticker"
import { heartbeatAckToken, sessionToken } from "../events"

/**
 * Start the sibling ticker workflow that drives this agent's heartbeat
 * loop. Returns the ticker workflow's runtime id so the session can
 * cancel it from its `finally` block.
 *
 * Always called from inside the session workflow via a `"use step"`
 * boundary because `start()` is a step-only API.
 */
export async function startTicker(input: {
  agentId: string
}): Promise<{ tickerRunId: string }> {
  "use step"
  const run = await start(agentTickerWorkflow, [{ agentId: input.agentId }])
  return { tickerRunId: run.runId }
}

/**
 * Cancel the ticker workflow. Best-effort: a missing or already-stopped
 * ticker is not an error — we always recreate one on session restart.
 */
export async function stopTicker(input: {
  tickerRunId: string
}): Promise<void> {
  "use step"
  try {
    const world = await getWorld()
    await world.events.create(input.tickerRunId, {
      eventType: "run_cancelled",
    })
  } catch (err) {
    console.error("[v0] stopTicker: failed to cancel ticker", err)
  }
}

/**
 * Push a heartbeat event into the session's hook. Called by
 * `agentTickerWorkflow` once per tick; the `ack` token is used by the
 * session to release the ticker after the handler completes.
 */
export async function pokeSessionHeartbeat(input: {
  agentId: string
  ack: string
}): Promise<void> {
  "use step"
  await resumeHook(sessionToken(input.agentId), {
    type: "heartbeat",
    ack: input.ack,
  })
}

/**
 * Resume the per-tick ack hook so the ticker can move on to its next
 * sleep interval. Called from the session workflow's heartbeat handler
 * once `handleHeartbeat` returns.
 *
 * Tolerant of conflicts: a stale ack (ticker already moved on, or the
 * ack hook never existed because the heartbeat was a one-shot trigger
 * push without an `ack` field) is logged and swallowed.
 */
export async function ackHeartbeat(input: {
  agentId: string
  ack: string
}): Promise<void> {
  "use step"
  try {
    await resumeHook(heartbeatAckToken(input.agentId, input.ack), {
      done: true,
    })
  } catch (err) {
    console.error("[v0] ackHeartbeat: resume failed", err)
  }
}


