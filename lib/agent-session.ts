import "server-only"
import { eq } from "drizzle-orm"
import { getRun, resumeHook, start } from "workflow/api"
import type { UIMessage } from "ai"
import { db } from "@/lib/db"
import { agent, type Agent } from "@/lib/db/schema"
import { agentSessionWorkflow } from "@/workflows/agent-session/workflow"
import { sessionToken } from "@/workflows/agent-session/events"

/**
 * Server-side helpers for managing an agent's long-lived session
 * workflow. All of the lifecycle is funneled through this module so
 * the API routes and `lib/agent-actions.ts` don't have to know about
 * `start()` / `resumeHook()` / hook tokens.
 *
 * Public API summary:
 *   - `startAgentSession(a)`     — idempotent lazy start
 *   - `restartAgentSession(a)`   — force a brand-new workflow run
 *   - `stopAgentSession(id)`     — push a `shutdown` event
 *   - `pokeHeartbeat({agent})`   — ensure running + push heartbeat
 *   - `dispatchChatTurn({...})`  — ensure running + push chat event,
 *                                   returns the per-turn reply
 *                                   namespace + sessionRunId
 *   - `isWorkflowRunAlive(id)`   — used by the liveness sweeper
 */

const TERMINAL_STATUSES = new Set(["completed", "failed", "cancelled"])

function newReplyToken() {
  return (
    "rep_" +
    Math.random().toString(36).slice(2, 10) +
    Date.now().toString(36).slice(-4)
  )
}

/**
 * Lazily start a fresh `agentSessionWorkflow` for this agent and
 * persist its workflow runtime id on the agent row.
 *
 * Idempotent: if `last_session_run_id` already points at a running
 * workflow, this returns that id unchanged.
 */
export async function startAgentSession(
  a: Agent,
): Promise<{ sessionRunId: string; started: boolean }> {
  const existing = await getRunningSessionRunId(a)
  if (existing) {
    return { sessionRunId: existing, started: false }
  }

  return doStart(a)
}

/**
 * Force a new session workflow regardless of the current state. Used
 * by the cron liveness sweeper when it detects a dead run.
 */
export async function restartAgentSession(
  a: Agent,
): Promise<{ sessionRunId: string }> {
  const { sessionRunId } = await doStart(a)
  return { sessionRunId }
}

async function doStart(
  a: Agent,
): Promise<{ sessionRunId: string; started: true }> {
  const run = await start(agentSessionWorkflow, [{ agentId: a.id }])

  await db
    .update(agent)
    .set({ lastSessionRunId: run.runId, updatedAt: new Date() })
    .where(eq(agent.id, a.id))

  return { sessionRunId: run.runId, started: true }
}

/**
 * Push a `shutdown` event into the session hook so the for-await loop
 * exits cleanly. Best-effort — a missing or already-stopped session
 * is not an error.
 *
 * After resuming the hook we poll the run's terminal state for a
 * bounded amount of time (default ~5s, 250ms intervals). This closes
 * a UX-visible race: a rapid disable→enable in the UI used to call
 * `startAgentSession` against an agent whose previous run was still
 * winding down, which made `getRunningSessionRunId` return the dying
 * id and the new "start" became a no-op. Bounded waiting keeps the
 * worst case acceptable for a UI handler; if we time out, the cron
 * liveness sweeper picks the agent up within 15 minutes anyway.
 */
export async function stopAgentSession(agentId: string): Promise<void> {
  let prevRunId: string | null = null
  try {
    const rows = await db
      .select({ id: agent.lastSessionRunId })
      .from(agent)
      .where(eq(agent.id, agentId))
      .limit(1)
    prevRunId = rows[0]?.id ?? null
  } catch {
    // best-effort: if we can't read the row we still attempt the
    // shutdown push below.
  }

  try {
    await resumeHook(sessionToken(agentId), { type: "shutdown" })
  } catch (err) {
    console.error("[v0] stopAgentSession: resume failed", err)
    return
  }

  if (!prevRunId) return

  const deadlineMs = Date.now() + 5_000
  const intervalMs = 250
  while (Date.now() < deadlineMs) {
    if (!(await isWorkflowRunAlive(prevRunId))) return
    await sleep(intervalMs)
  }

  console.warn(
    "[v0] stopAgentSession: run did not terminate within bound; " +
      "liveness sweeper will recover.",
    { agentId, prevRunId },
  )
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

/**
 * Ensure the session is running and push a single heartbeat event.
 * Returns the session run id. The push has no `ack` field so the
 * heartbeat handler runs but does not interfere with the periodic
 * ticker's own ack handshake.
 */
export async function pokeHeartbeat(opts: {
  agent: Agent
}): Promise<{ sessionRunId: string }> {
  const { sessionRunId } = await startAgentSession(opts.agent)
  await resumeHook(sessionToken(opts.agent.id), { type: "heartbeat" })
  return { sessionRunId }
}

/**
 * Ensure the session is running and push a chat event. Returns the
 * `sessionRunId` (so the API route can call `getRun(...).getReadable`)
 * and the unique `replyToken` used as the workflow stream namespace
 * for this turn.
 */
export async function dispatchChatTurn(opts: {
  agent: Agent
  conversationId: string
  uiMessages: UIMessage[]
}): Promise<{ sessionRunId: string; replyToken: string }> {
  const { sessionRunId } = await startAgentSession(opts.agent)
  const replyToken = newReplyToken()
  await resumeHook(sessionToken(opts.agent.id), {
    type: "chat",
    conversationId: opts.conversationId,
    uiMessages: opts.uiMessages,
    replyToken,
  })
  return { sessionRunId, replyToken }
}

/**
 * Return the workflow runtime id of the running session, or null if
 * `last_session_run_id` is unset or points at a terminated workflow.
 */
export async function getRunningSessionRunId(
  a: Agent,
): Promise<string | null> {
  if (!a.lastSessionRunId) return null
  return (await isWorkflowRunAlive(a.lastSessionRunId))
    ? a.lastSessionRunId
    : null
}

/**
 * Used by the cron liveness sweeper. Treats unreachable / not-found
 * runs as dead so leftover runs from a previous deploy don't hold the
 * session in a permanently-stale state.
 */
export async function isWorkflowRunAlive(
  workflowRunId: string,
): Promise<boolean> {
  try {
    const run = getRun(workflowRunId)
    const status = await run.status
    if (typeof status !== "string") return false
    return !TERMINAL_STATUSES.has(status)
  } catch {
    return false
  }
}


