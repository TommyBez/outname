import "server-only"
import { eq } from "drizzle-orm"
import { getRun, resumeHook, start } from "workflow/api"
import { db } from "@/lib/db"
import { agent, type Agent, type AgentKind } from "@/lib/db/schema"
import { agentSessionWorkflow } from "@/workflows/agent-session/workflow"
import { sessionToken } from "@/workflows/agent-session/events"
import { isAgentKind } from "@/workflows/agents/registry"

/**
 * Server-side helpers for managing an agent's long-lived session
 * workflow. Used by:
 *
 * - `lib/agent-actions.ts` (create / toggle / update / delete) to
 *   start and stop the workflow on enabled-state transitions.
 * - `app/api/agents/[agentId]/chat/route.ts` to lazy-start the session
 *   if it's not running and to push chat events.
 * - `app/api/agents/[agentId]/trigger/route.ts` to push a one-shot
 *   heartbeat.
 * - `app/api/cron/liveness/route.ts` to restart sessions that have
 *   ended unexpectedly.
 */

/**
 * Status values returned by the workflow runtime that mean "the
 * session is no longer running and needs to be (re)started".
 */
const TERMINAL_STATUSES = new Set([
  "completed",
  "failed",
  "cancelled",
])

/**
 * Lazily start a fresh `agentSessionWorkflow` for this agent and
 * persist its workflow runtime id on the agent row.
 *
 * Idempotent: if the existing `last_session_run_id` points at a still
 * running workflow, this returns that id unchanged. Use
 * `restartAgentSession` to force a brand-new run.
 */
export async function startAgentSession(
  a: Agent,
): Promise<{ sessionRunId: string; started: boolean }> {
  if (!isAgentKind(a.kind)) {
    throw new Error(`Unknown agent kind: ${a.kind}`)
  }

  const existing = await getRunningSessionRunId(a)
  if (existing) {
    return { sessionRunId: existing, started: false }
  }

  const run = await start(agentSessionWorkflow, [
    { agentId: a.id, kind: a.kind as AgentKind },
  ])

  await db
    .update(agent)
    .set({ lastSessionRunId: run.runId, updatedAt: new Date() })
    .where(eq(agent.id, a.id))

  return { sessionRunId: run.runId, started: true }
}

/**
 * Force a new session workflow regardless of the current state. Used
 * by the cron liveness sweeper when it suspects the existing run is
 * dead.
 */
export async function restartAgentSession(
  a: Agent,
): Promise<{ sessionRunId: string }> {
  if (!isAgentKind(a.kind)) {
    throw new Error(`Unknown agent kind: ${a.kind}`)
  }

  const run = await start(agentSessionWorkflow, [
    { agentId: a.id, kind: a.kind as AgentKind },
  ])

  await db
    .update(agent)
    .set({ lastSessionRunId: run.runId, updatedAt: new Date() })
    .where(eq(agent.id, a.id))

  return { sessionRunId: run.runId }
}

/**
 * Push a `shutdown` event into the session hook so the for-await loop
 * exits cleanly and the workflow's finally block tears the ticker
 * down. Best-effort — a missing or already-stopped session is not an
 * error.
 */
export async function stopAgentSession(agentId: string): Promise<void> {
  try {
    await resumeHook(sessionToken(agentId), { type: "shutdown" })
  } catch (err) {
    console.error("[v0] stopAgentSession: resume failed", err)
  }
}

/**
 * Push a one-shot heartbeat event into the session. No `ack` field —
 * this is a user-forced poke from the trigger button, not a scheduled
 * tick from the ticker workflow, so the session must not block on an
 * ack hook the caller never created.
 */
export async function pokeHeartbeat(agentId: string): Promise<void> {
  await resumeHook(sessionToken(agentId), { type: "heartbeat" })
}

/**
 * Return the workflow runtime id of the running session, or null if
 * the agent's `last_session_run_id` is unset or points at a workflow
 * that has terminated.
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
 * Used by the cron liveness sweeper to decide whether to restart a
 * session. Treats unreachable / not-found runs as dead so a previous
 * deploy's runs don't hold the session in a permanently-stale state.
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

/**
 * Same idempotent guarantee as `startAgentSession`, but without
 * actually pushing any event. Used by the chat route to lazy-start a
 * session before it resumes the hook with a chat event.
 */
export async function ensureAgentSession(
  a: Agent,
): Promise<{ sessionRunId: string }> {
  const { sessionRunId } = await startAgentSession(a)
  return { sessionRunId }
}
