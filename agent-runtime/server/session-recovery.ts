import 'server-only'

import { and, eq } from 'drizzle-orm'
import { getWorld } from 'workflow/runtime'
import { db } from '@/shared/db'
import { type Agent, agent } from '@/shared/db/schema'
import {
  acquireSessionControlLease,
  releaseSessionControlLease,
  type SessionControlLease,
} from './session-control-lease'
import {
  isWorkflowRunAlive,
  restartAgentSession,
  sleep,
} from './session-lifecycle'

const DEFAULT_RECOVERY_CANCEL_WAIT_MS = 10_000
const RECOVERY_POLL_MS = 250

export type RecoveryMode = 'safe' | 'force'

export interface RecoveryResult {
  mode: RecoveryMode
  previousSessionRunId: string | null
  previousTickerRunId: string | null
  reason: string
  recovered: boolean
  sessionEpoch: number | null
  sessionRunId: string | null
}

type CancellationResult = 'cancelled' | 'not_alive' | 'failed'

export function readRecoveryCancelWaitMs(): number {
  return readNonNegativeIntegerEnv(
    process.env.RECOVERY_CANCEL_WAIT_MS,
    DEFAULT_RECOVERY_CANCEL_WAIT_MS
  )
}

export async function recoverAgentSession(input: {
  agentId: string
  mode: RecoveryMode
  reason: string
}): Promise<RecoveryResult> {
  const lease = await acquireSessionControlLease(input.agentId)
  if (!lease) {
    return skipped(input, 'recovery_already_in_progress')
  }

  try {
    const current = await readAgent(input.agentId)
    if (!current) {
      return skipped(input, 'agent_not_found')
    }

    if (!current.enabled) {
      return skipped(input, 'agent_disabled', current)
    }

    const result = await recoverWithLease({
      agent: current,
      lease,
      mode: input.mode,
      reason: input.reason,
    })

    await recordRecovery({
      agentId: current.id,
      error: result.recovered ? null : result.reason,
      lease,
      mode: input.mode,
      reason: input.reason,
    })

    return result
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    await recordRecovery({
      agentId: input.agentId,
      error: message,
      lease,
      mode: input.mode,
      reason: input.reason,
    })
    return {
      mode: input.mode,
      previousSessionRunId: null,
      previousTickerRunId: null,
      reason: 'recovery_failed',
      recovered: false,
      sessionEpoch: null,
      sessionRunId: null,
    }
  } finally {
    await releaseSessionControlLease(lease)
  }
}

async function recoverWithLease(input: {
  agent: Agent
  lease: SessionControlLease
  mode: RecoveryMode
  reason: string
}): Promise<RecoveryResult> {
  const previousSessionRunId = input.agent.lastSessionRunId
  const previousTickerRunId = input.agent.lastTickerRunId

  if (previousSessionRunId) {
    const sessionAlive = await isWorkflowRunAlive(previousSessionRunId)

    if (sessionAlive) {
      const cancellation = await cancelWorkflowRun(previousSessionRunId)
      if (input.mode === 'safe') {
        if (cancellation === 'failed') {
          return failed(input, 'session_cancel_failed')
        }

        if (
          !(await waitUntilRunStops(
            previousSessionRunId,
            readRecoveryCancelWaitMs()
          ))
        ) {
          return failed(input, 'session_cancel_timeout')
        }
      }
    }
  }

  if (previousTickerRunId) {
    await cancelWorkflowRun(previousTickerRunId)
  }

  const { sessionEpoch, sessionRunId } = await restartAgentSession(
    input.agent,
    {
      lease: input.lease,
    }
  )

  return {
    mode: input.mode,
    previousSessionRunId,
    previousTickerRunId,
    reason: input.reason,
    recovered: true,
    sessionEpoch,
    sessionRunId,
  }
}

async function cancelWorkflowRun(
  workflowRunId: string
): Promise<CancellationResult> {
  if (!(await isWorkflowRunAlive(workflowRunId))) {
    return 'not_alive'
  }

  try {
    const world = getWorld()
    await world.events.create(workflowRunId, { eventType: 'run_cancelled' })
    return 'cancelled'
  } catch (err) {
    console.error('[v0] recovery: workflow cancellation failed', {
      err,
      workflowRunId,
    })
    return 'failed'
  }
}

async function recordRecovery(input: {
  agentId: string
  error: string | null
  lease: SessionControlLease
  mode: RecoveryMode
  reason: string
}): Promise<void> {
  await db
    .update(agent)
    .set({
      lastRecoveryAt: new Date(),
      lastRecoveryError: input.error,
      lastRecoveryMode: input.mode,
      lastRecoveryReason: input.reason,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(agent.id, input.agentId),
        eq(agent.sessionControlLeaseId, input.lease.leaseId)
      )
    )
}

async function waitUntilRunStops(
  workflowRunId: string,
  waitMs: number
): Promise<boolean> {
  const deadlineMs = Date.now() + waitMs

  while (Date.now() < deadlineMs) {
    if (!(await isWorkflowRunAlive(workflowRunId))) {
      return true
    }
    await sleep(RECOVERY_POLL_MS)
  }

  return !(await isWorkflowRunAlive(workflowRunId))
}

async function readAgent(agentId: string): Promise<Agent | null> {
  const [row] = await db
    .select()
    .from(agent)
    .where(eq(agent.id, agentId))
    .limit(1)
  return row ?? null
}

function failed(
  input: { agent: Agent; mode: RecoveryMode },
  reason: string
): RecoveryResult {
  return {
    mode: input.mode,
    previousSessionRunId: input.agent.lastSessionRunId,
    previousTickerRunId: input.agent.lastTickerRunId,
    reason,
    recovered: false,
    sessionEpoch: null,
    sessionRunId: null,
  }
}

function skipped(
  input: { agentId: string; mode: RecoveryMode },
  reason: string,
  agentRow?: Agent
): RecoveryResult {
  return {
    mode: input.mode,
    previousSessionRunId: agentRow?.lastSessionRunId ?? null,
    previousTickerRunId: agentRow?.lastTickerRunId ?? null,
    reason,
    recovered: false,
    sessionEpoch: null,
    sessionRunId: null,
  }
}

function readNonNegativeIntegerEnv(
  value: string | undefined,
  fallback: number
): number {
  if (!value) {
    return fallback
  }

  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}
