import 'server-only'
import type { UIMessage, UIMessageChunk } from 'ai'
import { eq } from 'drizzle-orm'
import { getHookByToken, getRun, resumeHook, start } from 'workflow/api'
import { db } from '@/lib/db'
import { type Agent, agent } from '@/lib/db/schema'
import {
  type SessionEvent,
  sessionToken,
} from '@/workflows/agent-session/events'
import { agentSessionWorkflow } from '@/workflows/agent-session/workflow'

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
 *   - `pokeReflection({agent})`  — ensure running + push reflection
 *   - `dispatchChatTurn({...})`  — ensure running + push chat event,
 *                                   returns the per-turn reply
 *                                   namespace + sessionRunId
 *   - `isWorkflowRunAlive(id)`   — used by the liveness sweeper
 */

const TERMINAL_STATUSES = new Set(['completed', 'failed', 'cancelled'])
const SESSION_HOOK_READY_TIMEOUT_MS = 5000
const SESSION_HOOK_POLL_MS = 100

function newReplyToken() {
  return (
    'rep_' +
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
  a: Agent
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
  a: Agent
): Promise<{ sessionRunId: string }> {
  const { sessionRunId } = await doStart(a)
  return { sessionRunId }
}

async function doStart(
  a: Agent
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
    await resumeHook(sessionToken(agentId), { type: 'shutdown' })
  } catch (err) {
    console.error('[v0] stopAgentSession: resume failed', err)
    return
  }

  if (!prevRunId) {
    return
  }

  const deadlineMs = Date.now() + 5000
  const intervalMs = 250
  while (Date.now() < deadlineMs) {
    if (!(await isWorkflowRunAlive(prevRunId))) {
      return
    }
    await sleep(intervalMs)
  }

  console.warn(
    '[v0] stopAgentSession: run did not terminate within bound; ' +
      'liveness sweeper will recover.',
    { agentId, prevRunId }
  )
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

function isHookNotFoundError(err: unknown): boolean {
  return err instanceof Error && err.name === 'HookNotFoundError'
}

async function waitForSessionHook(
  agentId: string,
  sessionRunId: string
): Promise<boolean> {
  const token = sessionToken(agentId)
  const deadlineMs = Date.now() + SESSION_HOOK_READY_TIMEOUT_MS

  while (Date.now() < deadlineMs) {
    try {
      const hook = await getHookByToken(token)
      if (hook.runId === sessionRunId) {
        return true
      }
    } catch (err) {
      if (!isHookNotFoundError(err)) {
        throw err
      }
    }

    if (!(await isWorkflowRunAlive(sessionRunId))) {
      return false
    }
    await sleep(SESSION_HOOK_POLL_MS)
  }

  return false
}

async function readySessionRunId(a: Agent): Promise<string> {
  let { sessionRunId } = await startAgentSession(a)
  if (await waitForSessionHook(a.id, sessionRunId)) {
    return sessionRunId
  }

  console.warn('[v0] agent session hook was not ready; restarting session', {
    agentId: a.id,
    sessionRunId,
  })

  ;({ sessionRunId } = await restartAgentSession(a))
  if (await waitForSessionHook(a.id, sessionRunId)) {
    return sessionRunId
  }

  throw new Error(
    `Session hook for agent ${a.id} was not ready after restart (${sessionRunId}).`
  )
}

async function resumeSessionEvent(
  a: Agent,
  event: SessionEvent
): Promise<{ sessionRunId: string }> {
  let sessionRunId = await readySessionRunId(a)
  try {
    await resumeHook(sessionToken(a.id), event)
    return { sessionRunId }
  } catch (err) {
    if (!isHookNotFoundError(err)) {
      throw err
    }
  }

  console.warn('[v0] agent session hook disappeared; restarting session', {
    agentId: a.id,
    sessionRunId,
  })

  sessionRunId = (await restartAgentSession(a)).sessionRunId
  if (!(await waitForSessionHook(a.id, sessionRunId))) {
    throw new Error(
      `Session hook for agent ${a.id} was not ready after recovery restart (${sessionRunId}).`
    )
  }

  await resumeHook(sessionToken(a.id), event)
  return { sessionRunId }
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
  return await resumeSessionEvent(opts.agent, {
    type: 'heartbeat',
    mode: 'normal',
    manual: true,
    scheduledAt: new Date().toISOString(),
  })
}

export async function pokeReflection(opts: {
  agent: Agent
  localDate: string
}): Promise<{ sessionRunId: string }> {
  return await resumeSessionEvent(opts.agent, {
    type: 'reflection',
    localDate: opts.localDate,
    manual: true,
    scheduledAt: new Date().toISOString(),
  })
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
  const replyToken = newReplyToken()
  const { sessionRunId } = await resumeSessionEvent(opts.agent, {
    type: 'chat',
    conversationId: opts.conversationId,
    uiMessages: opts.uiMessages,
    replyToken,
  })
  return { sessionRunId, replyToken }
}

/**
 * Phase 4: dispatch a sub-agent invocation.
 *
 * Used by the synthesised `agent_<child>` tool inside a parent's
 * workflow run. Wakes (or starts) the child agent's session and
 * pushes an `invocation` event. The child writes its UI stream into
 * `streamToken`; the parent tool reads that stream to produce its final
 * tool output.
 *
 * Throws if the child agent does not exist or does not belong to the
 * same user as the parent — the resolveToolPlan step is supposed to
 * filter those out before the parent's LLM sees the tool, so reaching
 * here means a runtime drift we don't want to silently swallow.
 */
export async function dispatchInvocation(input: {
  childAgentId: string
  childUserId: string
  parentUserId: string
  parentRunId: string | null
  parentToolId: string
  parentToolCallId?: string | null
  parentStream?: WritableStream<UIMessageChunk> | null
  instruction: string
  streamToken: string
  callStack: string[]
  depth: number
}): Promise<{ sessionRunId: string }> {
  if (input.childUserId !== input.parentUserId) {
    throw new Error(
      `dispatchInvocation: child ${input.childAgentId} does not belong to caller`
    )
  }

  const [child] = await db
    .select()
    .from(agent)
    .where(eq(agent.id, input.childAgentId))
    .limit(1)
  if (!child) {
    throw new Error(`dispatchInvocation: child ${input.childAgentId} not found`)
  }
  if (!child.enabled) {
    throw new Error(
      `dispatchInvocation: child ${input.childAgentId} is disabled`
    )
  }

  const { sessionRunId } = await resumeSessionEvent(child, {
    type: 'invocation',
    input: input.instruction,
    streamToken: input.streamToken,
    parentRunId: input.parentRunId,
    parentToolId: input.parentToolId,
    parentToolCallId: input.parentToolCallId ?? null,
    parentStream: input.parentStream ?? null,
    callStack: input.callStack,
    depth: input.depth,
  })
  return { sessionRunId }
}

/**
 * Return the workflow runtime id of the running session, or null if
 * `last_session_run_id` is unset or points at a terminated workflow.
 */
export async function getRunningSessionRunId(a: Agent): Promise<string | null> {
  if (!a.lastSessionRunId) {
    return null
  }
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
  workflowRunId: string
): Promise<boolean> {
  try {
    const run = getRun(workflowRunId)
    const status = await run.status
    if (typeof status !== 'string') {
      return false
    }
    return !TERMINAL_STATUSES.has(status)
  } catch {
    return false
  }
}
