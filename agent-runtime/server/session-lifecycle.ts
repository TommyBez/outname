import 'server-only'
import { and, eq, sql } from 'drizzle-orm'
import { getRun, resumeHook, start } from 'workflow/api'
import { sessionToken } from '@/agent-runtime/workflows/session/events'
import { agentSessionWorkflow } from '@/agent-runtime/workflows/session/workflow'
import { db } from '@/shared/db'
import { type Agent, agent } from '@/shared/db/schema'
import {
  acquireSessionControlLease,
  releaseSessionControlLease,
  type SessionControlLease,
  SessionControlLeaseBusyError,
} from './session-control-lease'

const TERMINAL_STATUSES = new Set(['completed', 'failed', 'cancelled'])
const SESSION_START_LEASE_WAIT_MS = 5000
const SESSION_START_LEASE_POLL_MS = 250

export async function startAgentSession(
  a: Agent
): Promise<{ sessionEpoch: number; sessionRunId: string; started: boolean }> {
  const existing = await getRunningSession(a)
  if (existing) {
    return {
      sessionEpoch: existing.sessionEpoch,
      sessionRunId: existing.sessionRunId,
      started: false,
    }
  }

  const lease = await acquireSessionControlLease(a.id)
  if (!lease) {
    const startedByOtherCaller = await waitForRunningSession(a.id)
    if (startedByOtherCaller) {
      return { ...startedByOtherCaller, started: false }
    }
    throw new SessionControlLeaseBusyError(a.id)
  }

  try {
    const current = await readAgentForSessionControl(a.id)
    if (!current) {
      throw new Error(`startAgentSession: agent ${a.id} not found`)
    }

    const existingAfterLock = await getRunningSession(current)
    if (existingAfterLock) {
      return { ...existingAfterLock, started: false }
    }

    return await doStart(current, lease)
  } finally {
    await releaseSessionControlLease(lease)
  }
}

export async function restartAgentSession(
  a: Agent,
  opts: { lease?: SessionControlLease } = {}
): Promise<{ sessionEpoch: number; sessionRunId: string }> {
  if (opts.lease) {
    const { sessionEpoch, sessionRunId } = await doStart(a, opts.lease)
    return { sessionEpoch, sessionRunId }
  }

  const lease = await acquireSessionControlLease(a.id)
  if (!lease) {
    throw new SessionControlLeaseBusyError(a.id)
  }

  try {
    const { sessionEpoch, sessionRunId } = await doStart(a, lease)
    return { sessionEpoch, sessionRunId }
  } finally {
    await releaseSessionControlLease(lease)
  }
}

async function doStart(
  a: Agent,
  lease: SessionControlLease
): Promise<{ sessionEpoch: number; sessionRunId: string; started: true }> {
  const [control] = await db
    .update(agent)
    .set({
      sessionEpoch: sql`${agent.sessionEpoch} + 1`,
      sessionEventRunId: null,
      sessionEventStartedAt: null,
      sessionEventType: null,
      updatedAt: new Date(),
    })
    .where(
      and(eq(agent.id, a.id), eq(agent.sessionControlLeaseId, lease.leaseId))
    )
    .returning({ sessionEpoch: agent.sessionEpoch })

  if (!control) {
    throw new Error(`doStart: lost session control lease for agent ${a.id}`)
  }

  const run = await start(agentSessionWorkflow, [
    { agentId: a.id, sessionEpoch: control.sessionEpoch },
  ])

  const rows = await db
    .update(agent)
    .set({
      lastRecoveryError: null,
      lastSessionRunId: run.runId,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(agent.id, a.id),
        eq(agent.sessionEpoch, control.sessionEpoch),
        eq(agent.sessionControlLeaseId, lease.leaseId)
      )
    )
    .returning({ id: agent.id })

  if (!rows[0]) {
    throw new Error(`doStart: failed to persist session run for agent ${a.id}`)
  }

  return {
    sessionEpoch: control.sessionEpoch,
    sessionRunId: run.runId,
    started: true,
  }
}

export async function stopAgentSession(agentId: string): Promise<void> {
  let prev: { sessionEpoch: number; sessionRunId: string | null } | null = null
  try {
    const [row] = await db
      .select({
        sessionEpoch: agent.sessionEpoch,
        sessionRunId: agent.lastSessionRunId,
      })
      .from(agent)
      .where(eq(agent.id, agentId))
      .limit(1)
    prev = row ?? null
  } catch {
    // Best-effort: if we can't read the row we still attempt shutdown.
  }

  try {
    await resumeHook(sessionToken(agentId, prev?.sessionEpoch ?? 0), {
      type: 'shutdown',
    })
  } catch (err) {
    console.error('[v0] stopAgentSession: resume failed', err)
    return
  }

  if (!prev?.sessionRunId) {
    return
  }

  const deadlineMs = Date.now() + 5000
  const intervalMs = 250
  while (Date.now() < deadlineMs) {
    if (!(await isWorkflowRunAlive(prev.sessionRunId))) {
      return
    }
    await sleep(intervalMs)
  }

  console.warn(
    '[v0] stopAgentSession: run did not terminate within bound; ' +
      'liveness sweeper will recover.',
    { agentId, prevRunId: prev.sessionRunId }
  )
}

export async function getRunningSessionRunId(a: Agent): Promise<string | null> {
  return (await getRunningSession(a))?.sessionRunId ?? null
}

async function getRunningSession(
  a: Agent
): Promise<{ sessionEpoch: number; sessionRunId: string } | null> {
  if (!a.lastSessionRunId) {
    return null
  }
  return (await isWorkflowRunAlive(a.lastSessionRunId))
    ? { sessionEpoch: a.sessionEpoch, sessionRunId: a.lastSessionRunId }
    : null
}

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

export function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

async function readAgentForSessionControl(
  agentId: string
): Promise<Agent | null> {
  const [row] = await db
    .select()
    .from(agent)
    .where(eq(agent.id, agentId))
    .limit(1)
  return row ?? null
}

async function waitForRunningSession(
  agentId: string
): Promise<{ sessionEpoch: number; sessionRunId: string } | null> {
  const deadlineMs = Date.now() + SESSION_START_LEASE_WAIT_MS

  while (Date.now() < deadlineMs) {
    const current = await readAgentForSessionControl(agentId)
    if (!current) {
      return null
    }

    const running = await getRunningSession(current)
    if (running) {
      return running
    }

    await sleep(SESSION_START_LEASE_POLL_MS)
  }

  return null
}
