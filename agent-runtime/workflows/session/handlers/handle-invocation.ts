import { convertToModelMessages, type UIMessage, type UIMessageChunk } from 'ai'
import { getWritable } from 'workflow'
import { startupSystemSandbox } from '@/agent-runtime/server/agent-sandbox'
import type { AgentChatMessage } from '@/agent-runtime/server/chat-status'
import {
  emitActivity,
  emitRun,
  emitStep,
} from '@/agent-runtime/server/run-events'
import { formatBudgetExceededMessage } from '@/budgets/server/errors'
import { buildAgent } from '../agent-factory'
import { resolveStepLimit } from '../step-limit'
import {
  extractTotalUsage,
  preflightBudget,
  recordTokenUsageStep,
} from '../steps/budget'
import { drainPendingWrites } from '../steps/drain-pending-writes'
import { finishSuccessfulInvocation } from './handle-invocation/finish-success'
import { startForwardingChildTrace } from './handle-invocation/forward-child-trace'
import {
  beginInvocationRun,
  invocationMessageId,
} from './handle-invocation/run-helpers'
import {
  finishUiMessageStream,
  writeUiMessageStreamError,
} from './handle-invocation/stream-control'

export async function handleInvocation(input: {
  agentId: string
  input: string
  streamToken: string
  parentRunId?: string | null
  parentToolId?: string | null
  parentToolCallId?: string | null
  parentStream?: WritableStream<UIMessageChunk> | null
  callStack: string[]
  depth: number
}): Promise<void> {
  const {
    agentId,
    input: instruction,
    streamToken,
    parentRunId,
    parentToolId,
    parentToolCallId,
    parentStream,
    callStack,
    depth,
  } = input
  const runId = await beginInvocationRun({
    agentId,
    parentRunId: parentRunId ?? null,
    parentToolId: parentToolId ?? null,
    streamToken,
  })
  const streamNamespace = streamToken
  const writable = getWritable<UIMessageChunk>({ namespace: streamNamespace })
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
      streamNamespace,
    })
    const rootAgentId = callStack[0] ?? agentId

    const exceeded = await preflightBudget({
      userId: built.meta.userId,
      rootAgentId,
    })
    if (exceeded) {
      await refuseBudgetExceeded({
        exceeded,
        runId,
        streamNamespace,
      })
      return
    }

    await emitActivity(runId, 'Sub-agent: Streaming model work', {
      model: built.meta.model,
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
    forwardPromise = startForwardingChildTrace({
      childAgentId: agentId,
      childName: built.meta.name,
      namespace: streamNamespace,
      parentStream: parentStream ?? null,
      parentToolCallId: parentToolCallId ?? null,
      runId,
      toolName: parentToolId ?? 'sub_agent',
    })
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
    })
    await finishUiMessageStream(streamNamespace).catch((err) => {
      console.error('[v0] handleInvocation: failed to close transcript', err)
    })
    await forwardPromise
  } catch (err) {
    await failInvocation({
      err,
      forwardPromise,
      runId,
      streamNamespace,
    })
    throw err
  }
}

async function prepareInvocationRun(input: {
  agentId: string
  depth: number
  parentRunId: string | null
  parentToolId: string | null
  runId: string
}): Promise<void> {
  await emitRun(input.runId, 'started', 'Sub-agent invocation started', {
    parentRunId: input.parentRunId,
    parentToolId: input.parentToolId,
  })
  await emitActivity(input.runId, 'Sub-agent: Preparing invocation', {
    depth: input.depth,
    parentRunId: input.parentRunId,
  })
  await startupSystemSandbox({ agentId: input.agentId })
  await emitActivity(input.runId, 'Sub-agent: Syncing bootstrap edits')
  await drainPendingWrites({ agentId: input.agentId })
}

async function refuseBudgetExceeded(input: {
  exceeded: Parameters<typeof formatBudgetExceededMessage>[0]
  runId: string
  streamNamespace: string
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
}

async function failInvocation(input: {
  err: unknown
  forwardPromise: Promise<AgentChatMessage[]>
  runId: string
  streamNamespace: string
}): Promise<void> {
  const message =
    input.err instanceof Error ? input.err.message : String(input.err)
  try {
    await emitActivity(input.runId, 'Sub-agent: Invocation failed', { message })
    await emitStep(input.runId, 'read', 'error', message)
    await emitRun(input.runId, 'failed', message)
  } catch (innerErr) {
    console.error(
      '[v0] handleInvocation: failed to emit failure breadcrumbs',
      innerErr
    )
  }
  await writeUiMessageStreamError(input.streamNamespace, message).catch(() => {
    // Best-effort signal for the parent-side collector.
  })
  await finishUiMessageStream(input.streamNamespace).catch(() => {
    // Best-effort close so the parent-side sub-agent tool stream can settle.
  })
  await input.forwardPromise.catch(() => {
    // Already logged by the forwarding task.
  })
}
