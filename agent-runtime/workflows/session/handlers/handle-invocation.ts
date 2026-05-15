import { convertToModelMessages, type UIMessage, type UIMessageChunk } from 'ai'
import { getWritable } from 'workflow'
import { getRun } from 'workflow/api'
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
  replyToken?: string | null
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
    replyToken,
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
  const streamNamespaces = uniqueNamespaces(streamNamespace, replyToken ?? null)
  const writable = getWritable<UIMessageChunk>({ namespace: streamNamespace })
  const mirrorNamespace = streamNamespaces.find(
    (namespace) => namespace !== streamNamespace
  )
  let forwardPromise = Promise.resolve([] as AgentChatMessage[])
  let mirrorPromise = Promise.resolve()

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
        exceeded,
        runId,
        streamNamespace,
        streamNamespaces,
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
    mirrorPromise = mirrorNamespace
      ? mirrorInvocationStream({
          runId,
          sourceNamespace: streamNamespace,
          targetNamespace: mirrorNamespace,
        })
      : Promise.resolve()
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
      streamNamespaces,
    })
    await finishInvocationStreams(streamNamespaces)
    await forwardPromise
    await mirrorPromise
  } catch (err) {
    await failInvocation({
      err,
      forwardPromise,
      runId,
      streamNamespace,
      streamNamespaces,
    })
    await mirrorPromise.catch(() => undefined)
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

async function mirrorInvocationStream(input: {
  runId: string
  sourceNamespace: string
  targetNamespace: string
}): Promise<void> {
  'use step'
  const source = getRun(input.runId).getReadable<UIMessageChunk>({
    namespace: input.sourceNamespace,
    startIndex: 0,
  })
  const target = getWritable<UIMessageChunk>({ namespace: input.targetNamespace })
  const sourceReader = source.getReader()
  const writer = target.getWriter()
  try {
    while (true) {
      const { done, value } = await sourceReader.read()
      if (done) {
        break
      }
      const chunk = value
      if (!chunk) {
        continue
      }
      await writer.write(chunk)
    }
  } catch (err) {
    console.error('handleInvocation: failed to mirror invocation stream', err)
  } finally {
    sourceReader.releaseLock()
    writer.releaseLock()
  }
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
  exceeded: Parameters<typeof formatBudgetExceededMessage>[0]
  runId: string
  streamNamespace: string
  streamNamespaces: readonly string[]
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
}

async function failInvocation(input: {
  err: unknown
  forwardPromise: Promise<AgentChatMessage[]>
  runId: string
  streamNamespace: string
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
