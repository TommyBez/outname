import {
  convertToModelMessages,
  readUIMessageStream,
  type StepResult,
  type ToolSet,
  type UIMessage,
  type UIMessageChunk,
} from 'ai'
import { getWorkflowMetadata, getWritable } from 'workflow'
import { getRun } from 'workflow/api'
import type { AgentChatChunk, AgentChatMessage } from '@/lib/agent-chat-status'
import { startupSystemSandbox } from '@/lib/agent-sandbox'
import { formatBudgetExceededMessage } from '@/lib/budget'
import { emitActivity, emitRun, emitStep } from '@/lib/run-events'
import type { SubAgentToolOutput } from '@/lib/sub-agent-tool-output'
import { buildAgent } from '../agent-factory'
import {
  buildStepLimitNotice,
  didReachStepLimit,
  resolveStepLimit,
  resolveStepLimitCount,
} from '../step-limit'
import {
  extractTotalUsage,
  preflightBudget,
  recordTokenUsageStep,
} from '../steps/budget'
import { drainPendingWrites } from '../steps/drain-pending-writes'
import {
  createPendingWrites,
  type PendingWrites,
} from '../tools/pending-writes'

/**
 * Invocation event handler — runs inside the **child** agent's session
 * workflow when a parent agent's `agent_<childId>` tool call dispatches
 * an `invocation` event onto its hook.
 *
 * Mirrors `handleChat` shape with key differences:
 *
 *   - No `conversationId` and no chat-message persistence — the
 *     parent's tool call IS the unit of conversation, not a UI thread.
 *   - Uses the child workflow runtime id for breadcrumbs and source
 *     attribution. Phase 5 removed the legacy `runs` table.
 *   - Streams to the invocation's unique stream token. The parent tool
 *     waits on that same stream and derives its final tool result from
 *     the collected UI messages.
 *
 * Returns the per-event `pending` queue so the session loop can pass
 * it to `endOfEvent`, exactly like `handleChat`.
 */
export async function handleInvocation(input: {
  agentId: string
  /** Parent's free-text instruction. Plays the role of the user turn. */
  input: string
  /** Unique stream namespace for this sub-agent invocation. */
  streamToken: string
  parentRunId?: string | null
  parentToolId?: string | null
  parentToolCallId?: string | null
  parentStream?: WritableStream<UIMessageChunk> | null
  callStack: string[]
  depth: number
}): Promise<{ pending: PendingWrites; runId: string }> {
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

  let pending: PendingWrites = createPendingWrites()
  let forwardPromise = Promise.resolve([] as AgentChatMessage[])

  try {
    await emitRun(runId, 'started', 'Sub-agent invocation started', {
      parentRunId: parentRunId ?? null,
      parentToolId: parentToolId ?? null,
    })
    await emitActivity(runId, 'Sub-agent: Preparing invocation', {
      depth,
      parentRunId: parentRunId ?? null,
    })
    await startupSystemSandbox({ agentId })
    await emitActivity(runId, 'Sub-agent: Syncing memory edits')
    await drainPendingWrites({ agentId })

    const built = await buildAgent({
      agentId,
      runId,
      currentRunId: runId,
      callStack,
      depth,
      streamNamespace,
    })
    pending = built.pending
    // Sub-agent spend is attributed to the **root** of the call stack
    // — the agent the operator originally invoked — so per-agent
    // budgets cap a tree of sub-agents, not just the leaf.
    const rootAgentId = callStack[0] ?? agentId

    const exceeded = await preflightBudget({
      userId: built.meta.userId,
      rootAgentId,
    })
    if (exceeded) {
      const message = formatBudgetExceededMessage(exceeded)
      await emitActivity(runId, 'Sub-agent: Budget exceeded, refusing', {
        period: exceeded.period,
        scope: exceeded.scope.type,
      })
      await emitStep(runId, 'read', 'error', message)
      await emitRun(runId, 'failed', message)
      await writeUiMessageStreamError(streamNamespace, message).catch(() => {
        // Best-effort signal so the parent-side collector doesn't hang.
      })
      await finishUiMessageStream(streamNamespace).catch(() => {
        // Best-effort close.
      })
      return { pending, runId }
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
    const message = err instanceof Error ? err.message : String(err)
    try {
      await emitActivity(runId, 'Sub-agent: Invocation failed', { message })
      await emitStep(runId, 'read', 'error', message)
      await emitRun(runId, 'failed', message)
    } catch (innerErr) {
      console.error(
        '[v0] handleInvocation: failed to emit failure breadcrumbs',
        innerErr
      )
    }
    await writeUiMessageStreamError(streamNamespace, message).catch(() => {
      // Best-effort signal for the parent-side collector.
    })
    await finishUiMessageStream(streamNamespace).catch(() => {
      // Best-effort close so the parent-side sub-agent tool stream
      // can settle even when the child run fails early.
    })
    await forwardPromise.catch(() => {
      // Already logged by the forwarding task.
    })
    // Re-throw so the session loop logs it just like a chat-handler
    // failure. The parent is unblocked by the closed invocation stream.
    throw err
  }

  return { pending, runId }
}

type StepLimitInput = Parameters<typeof resolveStepLimit>[0]

interface InvocationStreamResult {
  steps: readonly StepResult<ToolSet>[]
  uiMessages?: UIMessage[]
}

async function finishSuccessfulInvocation(input: {
  result: InvocationStreamResult
  runId: string
  stepLimitInput: StepLimitInput
  streamNamespace: string
}): Promise<void> {
  const { result, runId, stepLimitInput, streamNamespace } = input
  const hitStepLimit = didReachStepLimit({
    ...stepLimitInput,
    steps: result.steps,
  })
  if (hitStepLimit) {
    await emitActivity(
      runId,
      'Sub-agent: Step limit reached, finalizing early',
      {
        stepLimit: resolveStepLimitCount(stepLimitInput),
      }
    )
  }
  await emitStep(
    runId,
    'read',
    'done',
    hitStepLimit
      ? 'Sub-agent instruction reached the step limit'
      : 'Sub-agent instruction completed'
  )

  if (hitStepLimit) {
    await writeAssistantNotice(
      streamNamespace,
      formatStepLimitStreamText(
        result.uiMessages ?? [],
        buildStepLimitNotice(stepLimitInput)
      )
    )
  }
  await emitActivity(runId, 'Sub-agent: Finalizing reply')
  await emitRun(
    runId,
    'completed',
    hitStepLimit
      ? 'Sub-agent invocation completed after reaching the step limit'
      : 'Sub-agent invocation completed'
  )
}

function startForwardingChildTrace(input: {
  childAgentId: string
  childName: string
  namespace: string
  parentStream: WritableStream<UIMessageChunk> | null
  parentToolCallId: string | null
  runId: string
  toolName: string
}): Promise<AgentChatMessage[]> {
  if (!(input.parentStream && input.parentToolCallId)) {
    return Promise.resolve([])
  }

  return forwardChildTraceToParent({
    childAgentId: input.childAgentId,
    childName: input.childName,
    namespace: input.namespace,
    parentStream: input.parentStream,
    parentToolCallId: input.parentToolCallId,
    runId: input.runId,
    toolName: input.toolName,
  }).catch((err) => {
    console.error('[v0] handleInvocation: failed to forward child trace', err)
    return []
  })
}

async function forwardChildTraceToParent(input: {
  childAgentId: string
  childName: string
  namespace: string
  parentStream: WritableStream<UIMessageChunk>
  parentToolCallId: string
  runId: string
  toolName: string
}): Promise<AgentChatMessage[]> {
  'use step'
  const messages: AgentChatMessage[] = []
  const readable = getRun(input.runId).getReadable<AgentChatChunk>({
    namespace: input.namespace,
    startIndex: 0,
  })

  for await (const message of readUIMessageStream<AgentChatMessage>({
    stream: readable,
    terminateOnError: false,
  })) {
    upsertMessage(messages, message)
    await writeParentSubAgentOutput({
      output: {
        childAgentId: input.childAgentId,
        childName: input.childName,
        kind: 'sub_agent',
        messages: messages.slice(),
        status: 'running',
        toolName: input.toolName,
      },
      parentStream: input.parentStream,
      parentToolCallId: input.parentToolCallId,
    })
  }

  return messages
}

async function writeParentSubAgentOutput(input: {
  output: SubAgentToolOutput
  parentStream: WritableStream<UIMessageChunk>
  parentToolCallId: string
}): Promise<void> {
  const writer = input.parentStream.getWriter()
  try {
    await writer.write({
      type: 'tool-output-available',
      output: input.output,
      preliminary: true,
      toolCallId: input.parentToolCallId,
    })
  } finally {
    writer.releaseLock()
  }
}

function upsertMessage(
  messages: AgentChatMessage[],
  message: AgentChatMessage
): void {
  const index = messages.findIndex((item) => item.id === message.id)
  if (index < 0) {
    messages.push(message)
    return
  }
  messages[index] = message
}

async function finishUiMessageStream(namespace: string): Promise<void> {
  'use step'
  const writable = getWritable<UIMessageChunk>({
    namespace,
  })
  const writer = writable.getWriter()
  try {
    await writer.write({ type: 'finish' })
  } finally {
    writer.releaseLock()
  }
  await writable.close()
}

async function writeUiMessageStreamError(
  namespace: string,
  message: string
): Promise<void> {
  'use step'
  const writable = getWritable<UIMessageChunk>({
    namespace,
  })
  const writer = writable.getWriter()
  try {
    await writer.write({ type: 'error', errorText: message })
  } finally {
    writer.releaseLock()
  }
}

async function beginInvocationRun(input: {
  agentId: string
  parentRunId: string | null
  parentToolId: string | null
  streamToken: string
}): Promise<string> {
  'use step'
  await Promise.resolve()
  return currentWorkflowRunId(input)
}

function currentWorkflowRunId(input: {
  agentId: string
  streamToken: string
}): string {
  try {
    const metadata = getWorkflowMetadata() as {
      runId?: string
      workflowRunId?: string
    }
    const runId = metadata.runId ?? metadata.workflowRunId
    if (runId) {
      return runId
    }
  } catch {
    // Outside a workflow context, keep a deterministic local fallback.
  }
  return input.streamToken
}

function invocationMessageId(): string {
  return `inv_msg_${Math.random().toString(36).slice(2, 10)}`
}

function formatStepLimitStreamText(
  messages: readonly UIMessage[],
  notice: string
): string {
  const trimmedNotice = notice.trim()
  if (!trimmedNotice) {
    return ''
  }
  const lastMessage = messages.at(-1)
  const hasAssistantText =
    lastMessage?.role === 'assistant' &&
    lastMessage.parts.some(
      (part) => part.type === 'text' && part.text.trim().length > 0
    )
  return `${hasAssistantText ? '\n\n' : ''}${trimmedNotice}`
}

async function writeAssistantNotice(
  namespace: string,
  notice: string
): Promise<void> {
  'use step'
  if (!notice) {
    return
  }
  const writable = getWritable<UIMessageChunk>({
    namespace,
  })
  const writer = writable.getWriter()
  const partId = `step_limit_${Math.random().toString(36).slice(2, 10)}`
  try {
    await writer.write({ type: 'text-start', id: partId })
    await writer.write({ type: 'text-delta', id: partId, delta: notice })
    await writer.write({ type: 'text-end', id: partId })
  } finally {
    writer.releaseLock()
  }
}
