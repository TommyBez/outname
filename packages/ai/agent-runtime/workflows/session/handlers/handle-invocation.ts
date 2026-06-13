import {
  emitActivity,
  emitRun,
  emitStep,
} from '@outname/ai/agent-runtime/server/run-events'
import { createAssistantTextMessage } from '@outname/ai/agent-runtime/shared/message-utils'
import type { BuildAgentTool } from '@outname/ai/tools/sub-agents/agent-tool'
import { formatBudgetExceededMessage } from '@outname/shared/budgets/server/errors'
import { currentWorkflowRunId } from '@outname/shared/server/workflow-run-id'
import { getWritable } from '@outname/workflow/runtime'
import { convertToModelMessages, type UIMessage, type UIMessageChunk } from 'ai'
import { buildAgent } from '../agent-factory'
import {
  buildStepLimitNotice,
  didReachStepLimit,
  resolveStepLimit,
} from '../step-limit'
import {
  buildGenerationUsageObservations,
  preflightBudget,
  recordTokenUsageStep,
} from '../steps/budget'
import { replaceAgentEventTranscriptMessagesBestEffortStep } from '../steps/db/event-transcript-store'
import { startupSystemSandboxStep } from '../steps/db/system-sandbox'
import { persistAgentEventTranscriptStep } from '../steps/persist-event-transcript'
import { finishSuccessfulInvocation } from './handle-invocation/finish-success'
import {
  finishUiMessageStream,
  writeUiMessageStreamError,
} from './handle-invocation/stream-control'

export async function handleInvocation(input: {
  agentId: string
  buildSubAgentTool: BuildAgentTool
  eventId: string
  input: string
  streamToken: string
  parentRunId?: string | null
  parentToolId?: string | null
  parentToolCallId?: string | null
  callStack: string[]
  depth: number
  userId: string
}): Promise<void> {
  const {
    agentId,
    buildSubAgentTool,
    eventId,
    input: instruction,
    streamToken,
    parentRunId,
    parentToolId,
    callStack,
    depth,
    userId,
  } = input
  const runId = currentWorkflowRunId()
  const streamNamespace = streamToken

  try {
    await prepareInvocationRun({
      agentId,
      depth,
      parentRunId: parentRunId ?? null,
      parentToolId: parentToolId ?? null,
      runId,
    })

    const built = await buildAgent({
      agentId,
      buildSubAgentTool,
      runId,
      currentRunId: runId,
      callStack,
      depth,
      eventKind: 'invocation',
      streamNamespace,
    })
    const rootAgentId = callStack[0] ?? agentId

    const exceeded = await preflightBudget({
      userId: built.meta.userId,
      rootAgentId,
    })
    if (exceeded) {
      await refuseBudgetExceeded({
        eventId,
        exceeded,
        runId,
        streamNamespace,
        userId,
      })
      return
    }

    await emitActivity(runId, 'Sub-agent: Streaming model work', {
      model: built.meta.model,
    })
    const writable = getWritable<UIMessageChunk>({
      namespace: streamNamespace,
    })
    const stepLimitInput = {
      mode: built.meta.stepLimitMode,
      custom: built.meta.stepLimitCustom,
    } as const
    const userMessage: UIMessage = {
      id: invocationMessageId(),
      role: 'user',
      parts: [{ type: 'text', text: instruction }],
    }
    const modelMessages = await convertToModelMessages([userMessage])

    await emitStep(runId, 'read', 'start', 'Running sub-agent instruction')
    const result = await built.agent.stream({
      messages: modelMessages,
      writable,
      stopWhen: resolveStepLimit(stepLimitInput),
      collectUIMessages: true,
      preventClose: true,
      sendFinish: false,
    })
    await recordTokenUsageStep({
      userId: built.meta.userId,
      agentId,
      rootAgentId,
      sourceType: 'invocation',
      sourceId: runId,
      inferenceProvider: built.meta.inferenceProvider,
      model: built.meta.model,
      generations: buildGenerationUsageObservations(result),
    })
    await finishSuccessfulInvocation({
      result,
      runId,
      stepLimitInput,
      streamNamespace,
    })
    await finishInvocationStream(streamNamespace)
    await persistAgentEventTranscriptStep({
      event: {
        id: eventId,
        payload: {
          streamToken,
        },
        type: 'invocation',
      },
      stepLimitNotice: didReachStepLimit({
        ...stepLimitInput,
        steps: result.steps,
      })
        ? buildStepLimitNotice(stepLimitInput)
        : undefined,
      userId,
      workflowRunId: runId,
    })
  } catch (err) {
    await failInvocation({
      err,
      runId,
      streamNamespace,
    })
    throw err
  }
}

async function finishInvocationStream(namespace: string): Promise<void> {
  await finishUiMessageStream(namespace).catch((err) => {
    console.error('handleInvocation: failed to close transcript', err)
  })
}

async function prepareInvocationRun(input: {
  agentId: string
  depth: number
  parentRunId: string | null
  parentToolId: string | null
  runId: string
}): Promise<void> {
  await emitRun(input.runId, 'started', 'Sub-agent run started', {
    parentRunId: input.parentRunId,
    parentToolId: input.parentToolId,
  })
  await emitActivity(input.runId, 'Sub-agent: Preparing run', {
    depth: input.depth,
    parentRunId: input.parentRunId,
  })
  await startupSystemSandboxStep({ agentId: input.agentId })
}

async function refuseBudgetExceeded(input: {
  eventId: string
  exceeded: Parameters<typeof formatBudgetExceededMessage>[0]
  runId: string
  streamNamespace: string
  userId: string
}): Promise<void> {
  const message = formatBudgetExceededMessage(input.exceeded)
  await emitActivity(input.runId, 'Sub-agent: Budget exceeded, refusing', {
    period: input.exceeded.period,
    scope: input.exceeded.scope.type,
  })
  await emitStep(input.runId, 'read', 'error', message)
  await emitRun(input.runId, 'failed', message)
  await writeUiMessageStreamError(input.streamNamespace, message).catch(() => {
    // Best-effort signal so the parent-side collector doesn't hang.
  })
  await finishUiMessageStream(input.streamNamespace).catch(() => {
    // Best-effort close.
  })
  await replaceAgentEventTranscriptMessagesBestEffortStep({
    eventId: input.eventId,
    messages: [
      createAssistantTextMessage({
        id: `budget_refusal_${input.runId}`,
        text: message,
      }),
    ],
    userId: input.userId,
  })
}

async function failInvocation(input: {
  err: unknown
  runId: string
  streamNamespace: string
}): Promise<void> {
  const message =
    input.err instanceof Error ? input.err.message : String(input.err)
  try {
    await emitActivity(input.runId, 'Sub-agent: Run failed', { message })
    await emitStep(input.runId, 'read', 'error', message)
    await emitRun(input.runId, 'failed', message)
  } catch (innerErr) {
    console.error(
      'handleInvocation: failed to emit failure breadcrumbs',
      innerErr
    )
  }
  await writeUiMessageStreamError(input.streamNamespace, message).catch(() => {
    // Best-effort signal for the parent-side collector.
  })
  await finishUiMessageStream(input.streamNamespace).catch(() => {
    // Best-effort close so the parent-side sub-agent tool stream can settle.
  })
}

function invocationMessageId(): string {
  return `inv_msg_${Math.random().toString(36).slice(2, 10)}`
}
