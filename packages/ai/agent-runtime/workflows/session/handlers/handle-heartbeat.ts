import type { AgentModelCallChunk } from '@outname/ai/agent-runtime/server/chat-status'
import { emitActivity } from '@outname/ai/agent-runtime/server/run-events'
import { createAssistantTextMessage } from '@outname/ai/agent-runtime/shared/message-utils'
import type { BuildAgentTool } from '@outname/ai/tools/sub-agents/agent-tool'
import { currentWorkflowRunId, getWritable } from '@outname/workflow/runtime'
import type { StepResult, ToolSet } from 'ai'
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
import {
  buildGenerationUsageObservations,
  recordTokenUsageStep,
} from '../steps/budget'
import {
  markBudgetSkippedRunCompletedStep,
  markRunCompletedStep,
  readPreviousDreamingCompletionStep,
  readPreviousHeartbeatCompletionStep,
} from '../steps/db/agent-schedule'
import { replaceAgentEventTranscriptMessagesBestEffortStep } from '../steps/db/event-transcript-store'
import { startupSystemSandboxStep } from '../steps/db/system-sandbox'
import { finalizeRun } from '../steps/finalize-run'
import { initRun } from '../steps/init-run'
import { persistAgentEventTranscriptStep } from '../steps/persist-event-transcript'
import { checkBudgetOrFinalize } from './handle-heartbeat/budget'

type HeartbeatMode = 'normal' | 'dreaming'

export async function handleHeartbeat(input: {
  agentId: string
  buildSubAgentTool: BuildAgentTool
  eventId: string
  localDate?: string
  manual?: boolean
  mode?: HeartbeatMode
  replyToken: string
  scheduledAt?: string
  userId: string
}): Promise<void> {
  const { agentId, eventId, userId: eventUserId } = input
  const mode = input.mode ?? 'normal'
  const nowIso = input.scheduledAt ?? new Date().toISOString()
  const dreamingLocalDate = input.localDate ?? nowIso.slice(0, 10)
  const runId = currentWorkflowRunId()
  const outputNamespace = input.replyToken
  const writable = getWritable<AgentModelCallChunk>({
    namespace: outputNamespace,
  })

  try {
    await initRun(runId)
    await emitActivity(runId, activityMessage(mode, 'Preparing agent event'), {
      mode,
      manual: input.manual ?? false,
    })

    const budgetCheck = await checkBudgetOrFinalize({ agentId, mode, runId })
    if (budgetCheck.kind === 'exceeded') {
      await replaceAgentEventTranscriptMessagesBestEffortStep({
        eventId,
        messages: [
          createAssistantTextMessage({
            id: `budget_refusal_${eventId}`,
            text: budgetCheck.message,
          }),
        ],
        userId: eventUserId,
      })
      await markBudgetSkippedRunCompletedStep({
        agentId,
        localDate: dreamingLocalDate,
        mode,
      })
      return
    }

    const previousIso = await readPreviousCompletion(agentId, mode)
    await prepareHeartbeatSandbox({ agentId, mode, previousIso, runId })

    const { agent, meta, modelCallHeaders } = await buildAgent({
      agentId,
      buildSubAgentTool: input.buildSubAgentTool,
      runId,
      currentRunId: runId,
      eventKind: mode === 'dreaming' ? 'dreaming' : 'heartbeat',
      streamNamespace: outputNamespace,
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

    const result = await agent.stream({
      experimental_onStart: async () => {
        await emitActivity(runId, activityMessage(mode, 'Agent loop started'))
      },
      experimental_onStepStart: async ({ stepNumber }) => {
        await emitActivity(runId, activityMessage(mode, 'Model step started'), {
          stepNumber,
        })
      },
      messages: [{ role: 'user', content: kickoff }],
      headers: modelCallHeaders,
      onToolExecutionEnd: async ({ durationMs, success, toolCall }) => {
        await emitActivity(
          runId,
          activityMessage(mode, success ? 'Tool finished' : 'Tool failed'),
          {
            durationMs,
            toolName: toolCall.toolName,
          }
        )
      },
      onToolExecutionStart: async ({ toolCall }) => {
        await emitActivity(runId, activityMessage(mode, 'Tool started'), {
          toolName: toolCall.toolName,
        })
      },
      writable,
      stopWhen: resolveStepLimit(stepLimitInput),
    })
    await recordTokenUsageStep({
      userId: budgetCheck.userId,
      agentId,
      rootAgentId: agentId,
      sourceType: mode === 'dreaming' ? 'dreaming' : 'heartbeat',
      sourceId: runId,
      inferenceProvider: meta.inferenceProvider,
      model: meta.model,
      generations: buildGenerationUsageObservations(result),
    })

    await finalizeHeartbeatRun({
      agentId,
      localDate: dreamingLocalDate,
      mode,
      resultSteps: result.steps,
      runId,
      stepLimitInput,
    })
    await persistAgentEventTranscriptStep({
      event: {
        id: eventId,
        payload: {},
        type: mode === 'dreaming' ? 'dreaming' : 'heartbeat',
      },
      userId: eventUserId,
      workflowRunId: runId,
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
  await startupSystemSandboxStep({ agentId: input.agentId })
}

async function readPreviousCompletion(
  agentId: string,
  mode: HeartbeatMode
): Promise<string | null> {
  return mode === 'dreaming'
    ? await readPreviousDreamingCompletionStep(agentId)
    : await readPreviousHeartbeatCompletionStep(agentId)
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
  await markRunCompletedStep(input)
}

function activityMessage(mode: HeartbeatMode, message: string): string {
  return mode === 'dreaming' ? `Dreaming: ${message}` : message
}
