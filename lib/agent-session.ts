import 'server-only'
import type { UIMessage, UIMessageChunk } from 'ai'
import { and, eq, isNull, lt, or } from 'drizzle-orm'
import { getHookByToken, getRun, resumeHook, start } from 'workflow/api'
import { getWorld } from 'workflow/runtime'
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
const SESSION_START_LEASE_TTL_MS = 30_000
const SESSION_START_WAIT_TIMEOUT_MS = 35_000
const SESSION_START_WAIT_POLL_MS = 250
const SESSION_RESTART_GRACEFUL_STOP_TIMEOUT_MS = 2000
const SESSION_RESTART_CANCEL_TIMEOUT_MS = 3000
const SESSION_HOOK_READY_TIMEOUT_MS = 5000
const SESSION_HOOK_POLL_MS = 100

function newReplyToken() {
  return (
    'rep_' +
    Math.random().toString(36).slice(2, 10) +
    Date.now().toString(36).slice(-4)
  )
}

function newSessionStartToken(): string {
  return (
    'sst_' +
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
  return await ensureSessionStarted({ agentId: a.id, force: false })
}

/**
 * Force a new session workflow regardless of the current state. Used
 * by the cron liveness sweeper when it detects a dead run.
 */
export async function restartAgentSession(
  a: Agent
): Promise<{ sessionRunId: string }> {
  const { sessionRunId } = await ensureSessionStarted({
    agentId: a.id,
    force: true,
  })
  return { sessionRunId }
}

async function ensureSessionStarted(input: {
  agentId: string
  force: boolean
}): Promise<{ sessionRunId: string; started: boolean }> {
  const deadlineMs = Date.now() + SESSION_START_WAIT_TIMEOUT_MS

  if (!input.force) {
    const state = await readSessionStartState(input.agentId)
    if (!state) {
      throw new Error(
        `Agent ${input.agentId} not found while starting session.`
      )
    }
    if (isSessionStartLeaseActive(state, new Date())) {
      const winner = await waitForSessionStartWinner({
        agentId: input.agentId,
        deadlineMs,
      })
      if (winner) {
        return { sessionRunId: winner, started: false }
      }
    }

    const hookOwner = await readLiveSessionHookOwner(input.agentId)
    if (hookOwner) {
      await adoptSessionRunId(input.agentId, hookOwner)
      return { sessionRunId: hookOwner, started: false }
    }

    const existing = await readRunningSessionRunId(input.agentId)
    if (existing) {
      return { sessionRunId: existing, started: false }
    }
  }

  while (Date.now() < deadlineMs) {
    const token = newSessionStartToken()
    if (await tryAcquireSessionStartLease(input.agentId, token)) {
      return await doStartWithLease({
        agentId: input.agentId,
        replaceExisting: input.force,
        token,
      })
    }

    if (input.force) {
      await sleep(SESSION_START_WAIT_POLL_MS)
      continue
    }

    const winner = await waitForSessionStartWinner({
      agentId: input.agentId,
      deadlineMs,
    })
    if (winner) {
      return { sessionRunId: winner, started: false }
    }
  }

  throw new Error(
    `Timed out waiting to start session for agent ${input.agentId}`
  )
}

async function doStartWithLease(input: {
  agentId: string
  replaceExisting: boolean
  token: string
}): Promise<{ sessionRunId: string; started: boolean }> {
  try {
    if (input.replaceExisting) {
      await stopLiveSessionOwnerForRestart(input.agentId)
    }

    const run = await start(agentSessionWorkflow, [
      { agentId: input.agentId, sessionStartToken: input.token },
    ])
    const stored = await storeStartedSessionRunId({
      agentId: input.agentId,
      sessionRunId: run.runId,
      token: input.token,
    })
    if (stored) {
      return { sessionRunId: run.runId, started: true }
    }

    const winner = await waitForSessionStartWinner({
      agentId: input.agentId,
      deadlineMs: Date.now() + SESSION_START_WAIT_TIMEOUT_MS,
    })
    if (winner) {
      return { sessionRunId: winner, started: false }
    }

    throw new Error(
      `Session start lease for agent ${input.agentId} was lost before ${run.runId} could be stored.`
    )
  } catch (err) {
    await clearSessionStartLease({
      agentId: input.agentId,
      token: input.token,
    })
    throw err
  }
}

interface SessionStartState {
  lastSessionRunId: string | null
  sessionStartExpiresAt: Date | null
  sessionStartToken: string | null
}

async function readSessionStartState(
  agentId: string
): Promise<SessionStartState | null> {
  const [row] = await db
    .select({
      lastSessionRunId: agent.lastSessionRunId,
      sessionStartExpiresAt: agent.sessionStartExpiresAt,
      sessionStartToken: agent.sessionStartToken,
    })
    .from(agent)
    .where(eq(agent.id, agentId))
    .limit(1)
  return row ?? null
}

async function readRunningSessionRunId(
  agentId: string
): Promise<string | null> {
  const state = await readSessionStartState(agentId)
  if (!state?.lastSessionRunId) {
    return null
  }
  return (await isWorkflowRunAlive(state.lastSessionRunId))
    ? state.lastSessionRunId
    : null
}

async function readLiveSessionHookOwner(
  agentId: string
): Promise<string | null> {
  try {
    const hook = await getHookByToken(sessionToken(agentId))
    return (await isWorkflowRunAlive(hook.runId)) ? hook.runId : null
  } catch (err) {
    if (isHookNotFoundError(err)) {
      return null
    }
    throw err
  }
}

async function stopLiveSessionOwnerForRestart(agentId: string): Promise<void> {
  const hookOwner = await readLiveSessionHookOwner(agentId)
  if (!hookOwner) {
    return
  }

  try {
    await resumeHook(sessionToken(agentId), { type: 'shutdown' })
  } catch (err) {
    if (!isHookNotFoundError(err)) {
      console.warn(
        '[v0] restartAgentSession: graceful shutdown request failed',
        { agentId, hookOwner, err }
      )
    }
  }

  if (
    await waitForSessionOwnerToClear({
      agentId,
      sessionRunId: hookOwner,
      timeoutMs: SESSION_RESTART_GRACEFUL_STOP_TIMEOUT_MS,
    })
  ) {
    return
  }

  try {
    const world = await getWorld()
    await world.events.create(hookOwner, { eventType: 'run_cancelled' })
  } catch (err) {
    console.warn('[v0] restartAgentSession: force cancel failed', {
      agentId,
      hookOwner,
      err,
    })
  }

  if (
    await waitForSessionOwnerToClear({
      agentId,
      sessionRunId: hookOwner,
      timeoutMs: SESSION_RESTART_CANCEL_TIMEOUT_MS,
    })
  ) {
    return
  }

  throw new Error(
    `Timed out waiting for live session ${hookOwner} to stop before restarting agent ${agentId}.`
  )
}

async function waitForSessionOwnerToClear(input: {
  agentId: string
  sessionRunId: string
  timeoutMs: number
}): Promise<boolean> {
  const deadlineMs = Date.now() + input.timeoutMs
  while (Date.now() < deadlineMs) {
    if (!(await isWorkflowRunAlive(input.sessionRunId))) {
      return true
    }

    const hookOwner = await readLiveSessionHookOwner(input.agentId)
    if (hookOwner !== input.sessionRunId) {
      return true
    }

    await sleep(SESSION_START_WAIT_POLL_MS)
  }

  return false
}

async function tryAcquireSessionStartLease(
  agentId: string,
  token: string
): Promise<boolean> {
  const now = new Date()
  const expiresAt = new Date(now.getTime() + SESSION_START_LEASE_TTL_MS)
  const rows = await db
    .update(agent)
    .set({
      sessionStartExpiresAt: expiresAt,
      sessionStartToken: token,
      updatedAt: now,
    })
    .where(
      and(
        eq(agent.id, agentId),
        or(
          isNull(agent.sessionStartToken),
          isNull(agent.sessionStartExpiresAt),
          lt(agent.sessionStartExpiresAt, now)
        )
      )
    )
    .returning({ id: agent.id })

  return rows.length > 0
}

async function storeStartedSessionRunId(input: {
  agentId: string
  sessionRunId: string
  token: string
}): Promise<boolean> {
  const rows = await db
    .update(agent)
    .set({
      lastSessionRunId: input.sessionRunId,
      sessionStartExpiresAt: null,
      sessionStartToken: null,
      updatedAt: new Date(),
    })
    .where(
      and(eq(agent.id, input.agentId), eq(agent.sessionStartToken, input.token))
    )
    .returning({ id: agent.id })
  return rows.length > 0
}

async function clearSessionStartLease(input: {
  agentId: string
  token: string
}): Promise<void> {
  await db
    .update(agent)
    .set({
      sessionStartExpiresAt: null,
      sessionStartToken: null,
      updatedAt: new Date(),
    })
    .where(
      and(eq(agent.id, input.agentId), eq(agent.sessionStartToken, input.token))
    )
}

async function adoptSessionRunId(
  agentId: string,
  sessionRunId: string
): Promise<void> {
  await db
    .update(agent)
    .set({
      lastSessionRunId: sessionRunId,
      sessionStartExpiresAt: null,
      sessionStartToken: null,
      updatedAt: new Date(),
    })
    .where(eq(agent.id, agentId))
}

function isSessionStartLeaseActive(
  state: SessionStartState,
  now: Date
): boolean {
  return (
    state.sessionStartToken !== null &&
    state.sessionStartExpiresAt !== null &&
    state.sessionStartExpiresAt.getTime() > now.getTime()
  )
}

async function waitForSessionStartWinner(input: {
  agentId: string
  deadlineMs: number
}): Promise<string | null> {
  while (Date.now() < input.deadlineMs) {
    const state = await readSessionStartState(input.agentId)
    if (!state) {
      throw new Error(
        `Agent ${input.agentId} not found while starting session.`
      )
    }

    const leaseActive = isSessionStartLeaseActive(state, new Date())
    if (leaseActive) {
      await sleep(SESSION_START_WAIT_POLL_MS)
      continue
    }

    if (
      state.lastSessionRunId &&
      (await isWorkflowRunAlive(state.lastSessionRunId))
    ) {
      return state.lastSessionRunId
    }

    const hookOwner = await readLiveSessionHookOwner(input.agentId)
    if (hookOwner) {
      await adoptSessionRunId(input.agentId, hookOwner)
      return hookOwner
    }

    return null
  }

  return null
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

type SessionHookReadiness =
  | { kind: 'current' }
  | { kind: 'dead'; sessionRunId: string }
  | { kind: 'missing' }
  | { kind: 'other_live'; sessionRunId: string }

async function inspectSessionHook(
  agentId: string,
  expectedRunId: string
): Promise<SessionHookReadiness> {
  try {
    const hook = await getHookByToken(sessionToken(agentId))
    if (hook.runId === expectedRunId) {
      return (await isWorkflowRunAlive(expectedRunId))
        ? { kind: 'current' }
        : { kind: 'dead', sessionRunId: expectedRunId }
    }

    return (await isWorkflowRunAlive(hook.runId))
      ? { kind: 'other_live', sessionRunId: hook.runId }
      : { kind: 'dead', sessionRunId: hook.runId }
  } catch (err) {
    if (isHookNotFoundError(err)) {
      return { kind: 'missing' }
    }
    throw err
  }
}

async function waitForSessionHook(
  agentId: string,
  sessionRunId: string
): Promise<SessionHookReadiness> {
  const deadlineMs = Date.now() + SESSION_HOOK_READY_TIMEOUT_MS

  while (Date.now() < deadlineMs) {
    const readiness = await inspectSessionHook(agentId, sessionRunId)
    if (readiness.kind === 'current' || readiness.kind === 'other_live') {
      return readiness
    }
    if (readiness.kind === 'dead') {
      return readiness
    }

    if (!(await isWorkflowRunAlive(sessionRunId))) {
      return { kind: 'dead', sessionRunId }
    }
    await sleep(SESSION_HOOK_POLL_MS)
  }

  return { kind: 'missing' }
}

async function readySessionRunId(a: Agent): Promise<string> {
  let { sessionRunId } = await startAgentSession(a)
  let readiness = await waitForSessionHook(a.id, sessionRunId)
  if (readiness.kind === 'current') {
    return sessionRunId
  }
  if (readiness.kind === 'other_live') {
    await adoptSessionRunId(a.id, readiness.sessionRunId)
    return readiness.sessionRunId
  }

  console.warn('[v0] agent session hook was not ready; restarting session', {
    agentId: a.id,
    sessionRunId,
    readiness,
  })

  ;({ sessionRunId } = await restartAgentSession(a))
  readiness = await waitForSessionHook(a.id, sessionRunId)
  if (readiness.kind === 'current') {
    return sessionRunId
  }
  if (readiness.kind === 'other_live') {
    await adoptSessionRunId(a.id, readiness.sessionRunId)
    return readiness.sessionRunId
  }

  throw new Error(
    `Session hook for agent ${a.id} was not ready after restart (${sessionRunId}, ${readiness.kind}).`
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
  const readiness = await waitForSessionHook(a.id, sessionRunId)
  if (readiness.kind === 'other_live') {
    await adoptSessionRunId(a.id, readiness.sessionRunId)
    sessionRunId = readiness.sessionRunId
  } else if (readiness.kind !== 'current') {
    throw new Error(
      `Session hook for agent ${a.id} was not ready after recovery restart (${sessionRunId}, ${readiness.kind}).`
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
  return await readRunningSessionRunId(a.id)
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
