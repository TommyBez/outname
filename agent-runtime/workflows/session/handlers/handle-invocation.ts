import { convertToModelMessages, type UIMessage, type UIMessageChunk } from 'ai'
import { getWritable } from 'workflow'
import type { AgentChatMessage } from '@/agent-runtime/server/chat-status'
import {
  emitActivity,
  emitRun,
  emitStep,
} from '@/agent-runtime/server/run-events'
import { formatBudgetExceededMessage } from '@/budgets/server/errors'
import { currentWorkflowRunId } from '@/shared/server/workflow-run-id'
import { buildAgent } from '../agent-factory'
import { resolveStepLimit } from '../step-limit'
import {
  extractTotalUsage,
  preflightBudget,
  recordTokenUsageStep,
} from '../steps/budget'
import { startupSystemSandboxStep } from '../steps/db/system-sandbox'
import { finishSuccessfulInvocation } from './handle-invocation/finish-success'
import { invocationMessageId } from './handle-invocation/run-helpers'
import {
  finishUiMessageStream,
  writeUiMessageStreamError,
} from './handle-invocation/stream-control'

export async function handleInvocation(input: {
  agentId: string
  input: string
  streamToken: string
  parentAgentId?: string | null
  parentRunId?: string | null
  parentToolId?: string | null
  parentToolCallId?: string | null
  parentStream?: WritableStream<UIMessageChunk> | null
  reportBackToParent?: boolean
  replyToken?: string | null
  callStack: string[]
  depth: number
}): Promise<void> {
  const {
    agentId,
    input: instruction,
    parentAgentId,
    streamToken,
    parentRunId,
    parentToolId,
    parentToolCallId,
    parentStream,
    reportBackToParent,
    replyToken,
    callStack,
    depth,
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
    await maybeReportBackToParent({
      childAgentId: agentId,
      childName: built.meta.name,
      finalText: extractFinalAssistantText(result.uiMessages),
      parentAgentId: parentAgentId ?? null,
      reportBackToParent: reportBackToParent ?? false,
    })
  } catch (err) {
    await failInvocation({
      err,
      forwardPromise,
      runId,
      streamNamespace,
      streamNamespaces,
    })
    throw err
  }
}

async function maybeReportBackToParent(input: {
  childAgentId: string
  childName: string
  finalText: string | null
  parentAgentId: string | null
  reportBackToParent: boolean
}): Promise<void> {
  if (!input.reportBackToParent || !input.parentAgentId || !input.finalText) {
    return
  }
  const { dispatchInvocation } = await import(
    '@/agent-runtime/server/session-events'
  )
  await dispatchInvocation({
    childAgentId: input.parentAgentId,
    childUserId: await resolveAgentUserId(input.parentAgentId),
    parentAgentId: input.childAgentId,
    parentUserId: await resolveAgentUserId(input.parentAgentId),
    parentRunId: null,
    parentToolId: 'sub_agent_report_back',
    instruction: [
      `Sub-agent "${input.childName}" completed delegated async work.`,
      `Result: ${input.finalText}`,
    ].join('\n'),
    streamToken: `report_back_${Date.now().toString(36)}`,
    callStack: [input.parentAgentId],
    depth: 0,
  })
}

async function resolveAgentUserId(agentId: string): Promise<string> {
  const { db } = await import('@/shared/db')
  const { agent } = await import('@/shared/db/schema')
  const { eq } = await import('drizzle-orm')
  const [row] = await db.select().from(agent).where(eq(agent.id, agentId)).limit(1)
  if (!row) {
    throw new Error(`resolveAgentUserId: agent ${agentId} not found`)
  }
  return row.userId
}

function extractFinalAssistantText(
  messages: readonly UIMessage[] | undefined
): string | null {
  if (!messages) {
    return null
  }
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i]
    if (message.role !== 'assistant') {
      continue
    }
    const chunks: string[] = []
    for (const part of message.parts ?? []) {
      if (part.type === 'text' && typeof part.text === 'string') {
        chunks.push(part.text)
      }
    }
    const text = chunks.join('').trim()
    if (text.length > 0) {
      return text
    }
  }
  return null
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
  await startupSystemSandboxStep({ agentId: input.agentId })
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
