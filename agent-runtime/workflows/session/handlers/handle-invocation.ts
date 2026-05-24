import { convertToModelMessages, type UIMessage, type UIMessageChunk } from 'ai'
import { getWritable } from 'workflow'
import { readAgentEventTranscriptFromWorkflowRun } from '@/agent-runtime/server/agent-event-transcript'
import { replaceAgentEventTranscriptMessagesBestEffort } from '@/agent-runtime/server/agent-event-transcript-store'
import { startupSystemSandbox } from '@/agent-runtime/server/agent-sandbox'
import type { AgentChatMessage } from '@/agent-runtime/server/chat-status'
import {
  emitActivity,
  emitRun,
  emitStep,
} from '@/agent-runtime/server/run-events'
import { formatBudgetExceededMessage } from '@/budgets/server/errors'
import { currentWorkflowRunId } from '@/shared/server/workflow-run-id'
import { buildAgent } from '../agent-factory'
import {
  appendStepLimitNoticeToMessages,
  buildStepLimitNotice,
  didReachStepLimit,
  resolveStepLimit,
} from '../step-limit'
import {
  extractTotalUsage,
  preflightBudget,
  recordTokenUsageStep,
} from '../steps/budget'
import { finishSuccessfulInvocation } from './handle-invocation/finish-success'
import { invocationMessageId } from './handle-invocation/run-helpers'
import {
  finishUiMessageStream,
  writeUiMessageStreamError,
} from './handle-invocation/stream-control'

export async function handleInvocation(input: {
  agentId: string
  eventId: string
  input: string
  streamToken: string
  parentRunId?: string | null
  parentToolId?: string | null
  parentToolCallId?: string | null
  parentStream?: WritableStream<UIMessageChunk> | null
  replyToken?: string | null
  callStack: string[]
  depth: number
  userId: string
}): Promise<void> {
  const {
    agentId,
    eventId,
    input: instruction,
    streamToken,
    parentRunId,
    parentToolId,
    parentToolCallId,
    parentStream,
    replyToken,
    callStack,
    depth,
    userId,
  } = input
  const runId = currentWorkflowRunId()
  const streamNamespace = streamToken
  const streamNamespaces = uniqueNamespaces(streamNamespace, replyToken ?? null)
  let forwardPromise = Promise.resolve([] as AgentChatMessage[])

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
        streamNamespaces,
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
    if (parentStream && parentToolCallId) {
      const { startForwardingChildTrace } = await import(
        './handle-invocation/forward-child-trace'
      )
      forwardPromise = startForwardingChildTrace({
        childAgentId: agentId,
        childName: built.meta.name,
        namespace: streamNamespace,
        parentStream,
        parentToolCallId,
        runId,
        toolName: parentToolId ?? 'sub_agent',
      })
    }
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
      model: built.meta.model,
      usage: extractTotalUsage(result),
    })
    await finishSuccessfulInvocation({
      result,
      runId,
      stepLimitInput,
      streamNamespace,
      streamNamespaces,
    })
    await finishInvocationStreams(streamNamespaces)
    await forwardPromise
    const persistedMessages = await readAgentEventTranscriptFromWorkflowRun({
      event: {
        id: eventId,
        payload: {
          streamToken,
        },
        type: 'invocation',
      },
      workflowRunId: runId,
    })
    await replaceAgentEventTranscriptMessagesBestEffort({
      eventId,
      messages: appendStepLimitNoticeIfNeeded({
        messages: persistedMessages,
        stepLimitInput,
        steps: result.steps,
      }),
      userId,
    })
  } catch (err) {
    await failInvocation({
      err,
      forwardPromise,
      runId,
      streamNamespaces,
    })
    throw err
  }
}

async function finishInvocationStreams(
  namespaces: readonly string[]
): Promise<void> {
  await Promise.all(
    namespaces.map((namespace) =>
      finishUiMessageStream(namespace).catch((err) => {
        console.error('handleInvocation: failed to close transcript', err)
      })
    )
  )
}

function uniqueNamespaces(
  primaryNamespace: string,
  mirrorNamespace: string | null
): string[] {
  return [...new Set([primaryNamespace, mirrorNamespace].filter(isString))]
}

function isString(value: string | null): value is string {
  return typeof value === 'string' && value.length > 0
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
  await startupSystemSandbox({ agentId: input.agentId })
}

async function refuseBudgetExceeded(input: {
  eventId: string
  exceeded: Parameters<typeof formatBudgetExceededMessage>[0]
  runId: string
  streamNamespaces: readonly string[]
  userId: string
}): Promise<void> {
  const message = formatBudgetExceededMessage(input.exceeded)
  await emitActivity(input.runId, 'Sub-agent: Budget exceeded, refusing', {
    period: input.exceeded.period,
    scope: input.exceeded.scope.type,
  })
  await emitStep(input.runId, 'read', 'error', message)
  await emitRun(input.runId, 'failed', message)
  await Promise.all(
    input.streamNamespaces.map((namespace) =>
      writeUiMessageStreamError(namespace, message).catch(() => {
        // Best-effort signal so the parent-side collector doesn't hang.
      })
    )
  )
  await Promise.all(
    input.streamNamespaces.map((namespace) =>
      finishUiMessageStream(namespace).catch(() => {
        // Best-effort close.
      })
    )
  )
  await replaceAgentEventTranscriptMessagesBestEffort({
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
  forwardPromise: Promise<AgentChatMessage[]>
  runId: string
  streamNamespaces: readonly string[]
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
  await Promise.all(
    input.streamNamespaces.map((namespace) =>
      writeUiMessageStreamError(namespace, message).catch(() => {
        // Best-effort signal for the parent-side collector.
      })
    )
  )
  await Promise.all(
    input.streamNamespaces.map((namespace) =>
      finishUiMessageStream(namespace).catch(() => {
        // Best-effort close so the parent-side sub-agent tool stream can settle.
      })
    )
  )
  await input.forwardPromise.catch(() => {
    // Already logged by the forwarding task.
  })
}

function appendStepLimitNoticeIfNeeded(input: {
  messages: readonly UIMessage[]
  stepLimitInput: Parameters<typeof resolveStepLimit>[0]
  steps: Parameters<typeof didReachStepLimit>[0]['steps']
}): UIMessage[] {
  if (
    !didReachStepLimit({
      ...input.stepLimitInput,
      steps: input.steps,
    })
  ) {
    return [...input.messages]
  }
  return appendStepLimitNoticeToMessages(
    input.messages,
    buildStepLimitNotice(input.stepLimitInput)
  )
}

function createAssistantTextMessage(input: {
  id: string
  text: string
}): UIMessage {
  return {
    id: input.id,
    parts: [{ text: input.text, type: 'text' }],
    role: 'assistant',
  }
}
