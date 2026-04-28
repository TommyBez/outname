import { getRun, resumeHook, start } from "workflow/api"
import { getWorld } from "workflow/runtime"
import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { agent } from "@/lib/db/schema"
import { agentTickerWorkflow } from "../ticker"
import { heartbeatAckToken, sessionToken } from "../events"

const TERMINAL_STATUSES = new Set(["completed", "failed", "cancelled"])

/**
 * Local copy of the alive check used by `lib/agent-session.ts`. Inlined
 * here to break the circular import between `lib/agent-session` and
 * the session workflow's step modules. Kept tiny so it stays in sync
 * by inspection.
 */
async function isWorkflowRunAlive(workflowRunId: string): Promise<boolean> {
  try {
    const run = getRun(workflowRunId)
    const status = await run.status
    if (typeof status !== "string") return false
    return !TERMINAL_STATUSES.has(status)
  } catch {
    return false
  }
}

/**
 * Start the sibling ticker workflow that drives this agent's heartbeat
 * loop. Returns the ticker workflow's runtime id so the session can
 * cancel it from its `finally` block.
 *
 * The runtime id is also persisted onto the agent row so a session
 * that crashes without entering its `finally` block leaves a forensic
 * record we can reap (a) at the start of the next session and (b) via
 * the cron liveness sweeper.
 *
 * Always called from inside the session workflow via a `"use step"`
 * boundary because `start()` is a step-only API.
 */
export async function startTicker(input: {
  agentId: string
}): Promise<{ tickerRunId: string }> {
  "use step"
  const run = await start(agentTickerWorkflow, [{ agentId: input.agentId }])
  await db
    .update(agent)
    .set({ lastTickerRunId: run.runId, updatedAt: new Date() })
    .where(eq(agent.id, input.agentId))
  return { tickerRunId: run.runId }
}

/**
 * Cancel the ticker workflow and clear the tracking column. Best-effort:
 * a missing or already-stopped ticker is not an error — we always
 * recreate one on session restart. The DB column is cleared regardless
 * of cancel outcome, since the value only exists to find orphan runs
 * and the runtime treats already-terminal runs as a no-op cancel.
 */
export async function stopTicker(input: {
  agentId: string
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

  // Clear the column only when this is still the row's current ticker —
  // a racing newer session may have written a different id between our
  // read and write windows, and we do not want to clobber it.
  try {
    await db
      .update(agent)
      .set({ lastTickerRunId: null, updatedAt: new Date() })
      .where(eq(agent.lastTickerRunId, input.tickerRunId))
  } catch (err) {
    console.error("[v0] stopTicker: failed to clear column", err)
  }
}

/**
 * Reap an orphan ticker that survived a previous session crash. Called
 * from `agentSessionWorkflow` on entry, before starting a fresh ticker.
 *
 * Reads the agent row, checks whether `last_ticker_run_id` points at a
 * still-alive workflow run, and cancels it if so. The column is
 * cleared regardless so a subsequent `startTicker` writes a clean
 * value.
 */
export async function reapOrphanTicker(input: {
  agentId: string
}): Promise<{ cancelled: string | null }> {
  "use step"
  const rows = await db
    .select({ tickerRunId: agent.lastTickerRunId })
    .from(agent)
    .where(eq(agent.id, input.agentId))
    .limit(1)

  const prev = rows[0]?.tickerRunId ?? null
  if (!prev) return { cancelled: null }

  let cancelled: string | null = null
  try {
    if (await isWorkflowRunAlive(prev)) {
      const world = await getWorld()
      await world.events.create(prev, { eventType: "run_cancelled" })
      cancelled = prev
    }
  } catch (err) {
    console.error("[v0] reapOrphanTicker: cancel failed", err)
  }

  // Clear the slot unconditionally — `startTicker` is about to write a
  // fresh value over the top.
  try {
    await db
      .update(agent)
      .set({ lastTickerRunId: null, updatedAt: new Date() })
      .where(eq(agent.id, input.agentId))
  } catch (err) {
    console.error("[v0] reapOrphanTicker: clear column failed", err)
  }

  return { cancelled }
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
