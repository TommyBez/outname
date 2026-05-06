import type { UIMessageChunk } from 'ai'
import { eq } from 'drizzle-orm'
import { getWritable } from 'workflow'
import { startupExecSandbox, startupSystemSandbox } from '@/lib/agent-sandbox'
import { formatBudgetExceededMessage } from '@/lib/budget'
import { db } from '@/lib/db'
import { agent as agentTable } from '@/lib/db/schema'
import { emitActivity } from '@/lib/run-events'
import { getAgentById } from '@/lib/start-agent-run'
import {
  buildAgent,
  buildHeartbeatKickoff,
  buildReflectionKickoff,
} from '../agent-factory'
import {
  didReachStepLimit,
  resolveStepLimit,
  resolveStepLimitCount,
} from '../step-limit'
import { beginHeartbeatRun } from '../steps/begin-heartbeat-run'
import {
  extractTotalUsage,
  preflightBudget,
  recordTokenUsageStep,
} from '../steps/budget'
import { drainPendingWrites } from '../steps/drain-pending-writes'
import { finalizeRun } from '../steps/finalize-run'
import { initRun } from '../steps/init-run'
import {
  createPendingWrites,
  type PendingWrites,
} from '../tools/pending-writes'

/**
 * Heartbeat event handler — runs inside the long-lived session
 * workflow once per ticker tick (or once per "Trigger now" press).
 *
 * Phase 2 collapses the per-kind heartbeat lifecycle to a single
 * generic flow:
 *
 *   1. `beginHeartbeatRun` — read the current workflow runtime id.
 *   2. `initRun` — emit the canonical `started` event onto
 *      `events:${runId}` for workflow-level observability.
 *   3. Look up `agent.lastHeartbeatAt` (best effort, just for the
 *      kickoff prompt).
 *   4. Boot both sandboxes — system is required (system prompt),
 *      exec is best-effort.
 *   5. Build the agent via `buildAgent` and stream it against the
 *      generic `buildHeartbeatKickoff` user message. The agent
 *      decides what to do based on its inlined AGENTS.md /
 *      IDENTITY.md / SOUL.md and current memory inventory.
 *   6. `finalizeRun` — emit terminal progress breadcrumbs.
 *
 * Errors are caught and converted to failed breadcrumbs before
 * re-throwing so the session loop can surface them via its outer
 * try/catch without losing the workflow-level breadcrumb.
 *
 * Like `handleChat`, returns the per-event `pending` queue so
 * `agentSessionWorkflow` can flush it via `endOfEvent`.
 */
export async function handleHeartbeat(input: {
  agentId: string
  localDate?: string
  manual?: boolean
  mode?: 'normal' | 'reflection'
  scheduledAt?: string
}): Promise<{ pending: PendingWrites; runId: string }> {
  const { agentId } = input
  const mode = input.mode ?? 'normal'
  const nowIso = input.scheduledAt ?? new Date().toISOString()
  const reflectionLocalDate = input.localDate ?? nowIso.slice(0, 10)

  const { runId } = await beginHeartbeatRun({ agentId })

  // Per-workflow namespace. The legacy app-level run id is gone; this is
  // keyed directly by the workflow runtime id.
  const writable = getWritable<UIMessageChunk>({
    namespace: runId,
  })

  try {
    await initRun(runId)
    await emitActivity(
      runId,
      activityMessage(mode, 'Preparing agent session'),
      {
        mode,
        manual: input.manual ?? false,
      }
    )

    const userId = await checkBudgetOrFinalize({
      agentId,
      mode,
      runId,
    })
    if (userId === BUDGET_EXCEEDED) {
      await markBudgetSkippedRunCompleted({
        agentId,
        localDate: reflectionLocalDate,
        mode,
      })
      return { pending: createPendingWrites(), runId }
    }

    const previousIso =
      mode === 'reflection'
        ? await readPreviousReflectionCompletion(agentId)
        : await readPreviousHeartbeatCompletion(agentId)

    await emitActivity(runId, activityMessage(mode, 'Starting sandboxes'), {
      previousIso,
    })
    await startupSystemSandbox({ agentId })
    await startupExecSandbox({ agentId }).catch((err) => {
      // Don't fail the heartbeat just because exec didn't boot — the
      // agent can still touch memory files. exec_* tools surface their
      // own errors per call.
      console.error('[v0] handleHeartbeat: startupExecSandbox failed', err)
    })

    await emitActivity(runId, activityMessage(mode, 'Syncing memory edits'))
    // Drain UI-authored persona-file edits before composeSystemPrompt
    // reads them inside buildAgent.
    await drainPendingWrites({ agentId })

    const {
      agent: durableAgent,
      meta,
      pending,
    } = await buildAgent({
      agentId,
      runId,
      currentRunId: runId,
    })

    await emitActivity(runId, activityMessage(mode, 'Streaming model work'), {
      model: meta.model,
    })
    const stepLimitInput = {
      mode: meta.stepLimitMode,
      custom: meta.stepLimitCustom,
    } as const
    const kickoff =
      mode === 'reflection'
        ? buildReflectionKickoff({
            localDate: reflectionLocalDate,
            manual: input.manual ?? false,
            nowIso,
            previousIso,
          })
        : buildHeartbeatKickoff({
            nowIso,
            previousIso,
          })

    const result = await durableAgent.stream({
      messages: [{ role: 'user', content: kickoff }],
      writable,
      stopWhen: resolveStepLimit(stepLimitInput),
    })
    if (userId) {
      await recordTokenUsageStep({
        userId,
        agentId,
        rootAgentId: agentId,
        sourceType: mode === 'reflection' ? 'reflection' : 'heartbeat',
        sourceId: runId,
        model: meta.model,
        usage: extractTotalUsage(result),
      })
    }
    const hitStepLimit = didReachStepLimit({
      ...stepLimitInput,
      steps: result.steps,
    })

    if (hitStepLimit) {
      await emitActivity(
        runId,
        activityMessage(mode, 'Step limit reached, finalizing early'),
        {
          stepLimit: resolveStepLimitCount(stepLimitInput),
        }
      )
    } else {
      await emitActivity(runId, activityMessage(mode, 'Finalizing changes'))
    }
    await finalizeRun(
      runId,
      'completed',
      hitStepLimit
        ? activityMessage(mode, 'Completed after reaching the step limit')
        : undefined
    )
    await markRunCompleted({
      agentId,
      localDate: reflectionLocalDate,
      mode,
    })

    return { pending, runId }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await emitActivity(runId, activityMessage(mode, 'Run failed'), { message })
    await finalizeRun(runId, 'failed', message)
    throw err
  }
}

function activityMessage(
  mode: 'normal' | 'reflection',
  message: string
): string {
  return mode === 'reflection' ? `Reflection: ${message}` : message
}

const BUDGET_EXCEEDED = Symbol('budget-exceeded')

/**
 * Resolve the owning user and pre-flight the budget. Returns the
 * `userId` when the run can proceed, `null` when ownership is
 * unresolved (still proceed with no-op accounting), or
 * `BUDGET_EXCEEDED` when the caller must short-circuit.
 */
async function checkBudgetOrFinalize(input: {
  agentId: string
  mode: 'normal' | 'reflection'
  runId: string
}): Promise<string | null | typeof BUDGET_EXCEEDED> {
  const { agentId, mode, runId } = input
  const agentRow = await getAgentById(agentId)
  const userId = agentRow?.userId ?? null
  if (!userId) {
    return null
  }
  const exceeded = await preflightBudget({
    userId,
    rootAgentId: agentId,
  })
  if (!exceeded) {
    return userId
  }
  await emitActivity(
    runId,
    activityMessage(mode, 'Budget exceeded, skipping run'),
    {
      period: exceeded.period,
      scope: exceeded.scope.type,
    }
  )
  await finalizeRun(runId, 'completed', formatBudgetExceededMessage(exceeded))
  return BUDGET_EXCEEDED
}

/**
 * Best-effort lookup of the most recent completed heartbeat for this
 * agent. Returns `null` if there isn't one. Used purely as a hint in the
 * kickoff message.
 */
async function readPreviousHeartbeatCompletion(
  agentId: string
): Promise<string | null> {
  'use step'
  const [row] = await db
    .select({ lastHeartbeatAt: agentTable.lastHeartbeatAt })
    .from(agentTable)
    .where(eq(agentTable.id, agentId))
    .limit(1)
  return row?.lastHeartbeatAt ? row.lastHeartbeatAt.toISOString() : null
}

async function readPreviousReflectionCompletion(
  agentId: string
): Promise<string | null> {
  'use step'
  const [row] = await db
    .select({ lastReflectionAt: agentTable.lastReflectionAt })
    .from(agentTable)
    .where(eq(agentTable.id, agentId))
    .limit(1)
  return row?.lastReflectionAt ? row.lastReflectionAt.toISOString() : null
}

async function markHeartbeatCompleted(agentId: string): Promise<void> {
  'use step'
  await db
    .update(agentTable)
    .set({
      lastHeartbeatAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(agentTable.id, agentId))
}

async function markBudgetSkippedRunCompleted(input: {
  agentId: string
  localDate: string
  mode: 'normal' | 'reflection'
}): Promise<void> {
  if (input.mode !== 'reflection') {
    return
  }
  // Reflection due checks key off these fields, so a budget-skipped
  // reflection still needs to count as today's completed attempt.
  await markReflectionCompleted({
    agentId: input.agentId,
    localDate: input.localDate,
  })
}

async function markRunCompleted(input: {
  agentId: string
  localDate: string
  mode: 'normal' | 'reflection'
}): Promise<void> {
  if (input.mode === 'reflection') {
    await markReflectionCompleted({
      agentId: input.agentId,
      localDate: input.localDate,
    })
    return
  }
  await markHeartbeatCompleted(input.agentId)
}

async function markReflectionCompleted(input: {
  agentId: string
  localDate: string
}): Promise<void> {
  'use step'
  await db
    .update(agentTable)
    .set({
      lastReflectionAt: new Date(),
      lastReflectionLocalDate: input.localDate,
      updatedAt: new Date(),
    })
    .where(eq(agentTable.id, input.agentId))
}
