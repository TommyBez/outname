import type { StepResult, ToolSet, UIMessageChunk } from 'ai'
import { getWritable } from 'workflow'
import { startupSystemSandbox } from '@/agent-runtime/server/agent-sandbox'
import { emitActivity } from '@/agent-runtime/server/run-events'
import {
  buildAgent,
  buildDreamingKickoff,
  buildHeartbeatKickoff,
} from '../agent-factory'
import {
  didReachStepLimit,
  resolveStepLimit,
  resolveStepLimitCount,
} from '../step-limit'
import { beginHeartbeatRun } from '../steps/begin-heartbeat-run'
import { extractTotalUsage, recordTokenUsageStep } from '../steps/budget'
import { finalizeRun } from '../steps/finalize-run'
import { initRun } from '../steps/init-run'
import {
  BUDGET_EXCEEDED,
  checkBudgetOrFinalize,
} from './handle-heartbeat/budget'
import {
  activityMessage,
  type HeartbeatMode,
} from './handle-heartbeat/messages'
import {
  markBudgetSkippedRunCompleted,
  markRunCompleted,
  readPreviousDreamingCompletion,
  readPreviousHeartbeatCompletion,
} from './handle-heartbeat/state'

export async function handleHeartbeat(input: {
  agentId: string
  localDate?: string
  manual?: boolean
  mode?: HeartbeatMode
  replyToken?: string
  scheduledAt?: string
}): Promise<void> {
  const { agentId } = input
  const mode = input.mode ?? 'normal'
  const nowIso = input.scheduledAt ?? new Date().toISOString()
  const dreamingLocalDate = input.localDate ?? nowIso.slice(0, 10)
  const { runId } = await beginHeartbeatRun({ agentId })
  const outputNamespace = input.replyToken ?? runId
  const writable = getWritable<UIMessageChunk>({ namespace: outputNamespace })

  try {
    await initRun(runId)
    await emitActivity(runId, activityMessage(mode, 'Preparing agent event'), {
      mode,
      manual: input.manual ?? false,
    })

    const userId = await checkBudgetOrFinalize({ agentId, mode, runId })
    if (userId === BUDGET_EXCEEDED) {
      await markBudgetSkippedRunCompleted({
        agentId,
        localDate: dreamingLocalDate,
        mode,
      })
      return
    }

    const previousIso = await readPreviousCompletion(agentId, mode)
    await prepareHeartbeatSandbox({ agentId, mode, previousIso, runId })

    const { agent: durableAgent, meta } = await buildAgent({
      agentId,
      runId,
      currentRunId: runId,
      eventKind: mode === 'dreaming' ? 'dreaming' : 'heartbeat',
    })

    await emitActivity(runId, activityMessage(mode, 'Streaming model work'), {
      model: meta.model,
    })
    const stepLimitInput = {
      mode: meta.stepLimitMode,
      custom: meta.stepLimitCustom,
    } as const
    const kickoff =
      mode === 'dreaming'
        ? buildDreamingKickoff({
            localDate: dreamingLocalDate,
            manual: input.manual ?? false,
            nowIso,
            previousIso,
          })
        : buildHeartbeatKickoff({ nowIso, previousIso })

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
        sourceType: mode === 'dreaming' ? 'dreaming' : 'heartbeat',
        sourceId: runId,
        model: meta.model,
        usage: extractTotalUsage(result),
      })
    }

    await finalizeHeartbeatRun({
      agentId,
      localDate: dreamingLocalDate,
      mode,
      resultSteps: result.steps,
      runId,
      stepLimitInput,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await emitActivity(runId, activityMessage(mode, 'Run failed'), { message })
    await finalizeRun(runId, 'failed', message)
    throw err
  }
}

async function prepareHeartbeatSandbox(input: {
  agentId: string
  mode: HeartbeatMode
  previousIso: string | null
  runId: string
}): Promise<void> {
  await emitActivity(
    input.runId,
    activityMessage(input.mode, 'Starting sandbox'),
    {
      previousIso: input.previousIso,
    }
  )
  await startupSystemSandbox({ agentId: input.agentId })
}

async function readPreviousCompletion(
  agentId: string,
  mode: HeartbeatMode
): Promise<string | null> {
  return mode === 'dreaming'
    ? await readPreviousDreamingCompletion(agentId)
    : await readPreviousHeartbeatCompletion(agentId)
}

async function finalizeHeartbeatRun(input: {
  agentId: string
  localDate: string
  mode: HeartbeatMode
  resultSteps: readonly StepResult<ToolSet>[]
  runId: string
  stepLimitInput: Parameters<typeof resolveStepLimit>[0]
}): Promise<void> {
  const hitStepLimit = didReachStepLimit({
    ...input.stepLimitInput,
    steps: input.resultSteps,
  })

  if (hitStepLimit) {
    await emitActivity(
      input.runId,
      activityMessage(input.mode, 'Step limit reached, finalizing early'),
      { stepLimit: resolveStepLimitCount(input.stepLimitInput) }
    )
  } else {
    await emitActivity(
      input.runId,
      activityMessage(input.mode, 'Finalizing changes')
    )
  }
  await finalizeRun(
    input.runId,
    'completed',
    hitStepLimit
      ? activityMessage(input.mode, 'Completed after reaching the step limit')
      : undefined
  )
  await markRunCompleted(input)
}
