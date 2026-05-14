import {
  convertToModelMessages,
  type ModelMessage,
  type UIMessage,
  type UIMessageChunk,
} from 'ai'
import { getWorkflowMetadata, getWritable } from 'workflow'
import { startupSystemSandbox } from '@/agent-runtime/server/agent-sandbox'
import { emitActivity } from '@/agent-runtime/server/run-events'
import { getAgentById } from '@/agent-runtime/server/start-agent-run'
import { formatBudgetExceededMessage } from '@/budgets/server/errors'
import { compactSubAgentToolOutputsForModel } from '@/chat/server/chat-model'
import { maybeGenerateConversationTitle } from '@/chat/workflows/steps/generate-conversation-title'
import { persistAssistantTurn } from '@/chat/workflows/steps/persist-assistant-turn'
import { buildAgent } from '../agent-factory'
import {
  appendStepLimitNoticeToMessages,
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
import { emitChatStatus } from '../steps/emit-chat-status'

// Workflow-side chat handler: boot the system sandbox, build the event-scoped
// agent, and stream into the reply-token namespace. Tool bodies cross back into
// `"use step"` as needed.
export async function handleChat(input: {
  agentId: string
  conversationId: string
  // Pre-converted history from channel adapters that own the thread (Chat
  // SDK `toAiMessages`). When present, the model sees this directly instead
  // of converting `uiMessages`, which for non-web sources only carries the
  // newly-arrived user turn.
  modelMessages?: ModelMessage[]
  replyToken: string
  uiMessages: UIMessage[]
}): Promise<void> {
  const { agentId, conversationId, modelMessages, replyToken, uiMessages } =
    input
  const sessionRunId = await currentSessionRunId(conversationId)

  const writable = getWritable<UIMessageChunk>({
    namespace: replyToken,
  })

  // Fail fast on budget exhaustion before booting any sandboxes.
  const agentRow = await getAgentById(agentId)
  const userId = agentRow?.userId ?? null
  if (userId) {
    const exceeded = await preflightBudget({
      userId,
      rootAgentId: agentId,
    })
    if (exceeded) {
      const message = formatBudgetExceededMessage(exceeded)
      await emitActivity(sessionRunId, 'Chat: Budget exceeded, refusing turn', {
        conversationId,
        period: exceeded.period,
        scope: exceeded.scope.type,
      })
      await emitChatStatus({
        message,
        phase: 'agent-stream',
        replyToken,
      })
      await writeAssistantNotice(replyToken, message)
      await finishUiMessageStream(replyToken).catch(() => {
        // Best-effort: stream close is informational here.
      })
      await persistAssistantTurn({
        agentId,
        conversationId,
        uiMessages: [
          createAssistantNoticeMessage(`budget_refusal_${replyToken}`, message),
        ],
      })
      await emitActivity(sessionRunId, 'Chat: Budget refusal saved', {
        conversationId,
      })
      return
    }
  }

  await emitActivity(sessionRunId, 'Chat: Preparing response', {
    conversationId,
  })
  await startupSystemSandbox({ agentId })

  const { agent, meta, tools } = await buildAgent({
    agentId,
    runId: conversationId,
    currentRunId: sessionRunId,
    conversationId,
    eventKind: 'chat',
    streamNamespace: replyToken,
  })

  const resolvedModelMessages =
    modelMessages ??
    (await convertToModelMessages(
      compactSubAgentToolOutputsForModel(uiMessages),
      { tools }
    ))
  await emitActivity(sessionRunId, 'Chat: Streaming model response', {
    model: meta.model,
  })
  const stepLimitInput = {
    mode: meta.stepLimitMode,
    custom: meta.stepLimitCustom,
  } as const

  await emitChatStatus({
    message: 'Connecting to the agent...',
    phase: 'agent-stream',
    replyToken,
  })
  const titlePromise = maybeGenerateConversationTitle({
    agentId,
    conversationId,
    uiMessages,
  })
  const streamPromise = agent.stream({
    messages: resolvedModelMessages,
    writable,
    stopWhen: resolveStepLimit(stepLimitInput),
    collectUIMessages: true,
    preventClose: true,
    sendFinish: false,
  })
  let streamClosed = false
  try {
    const [, result] = await Promise.all([titlePromise, streamPromise])

    if (userId) {
      await recordTokenUsageStep({
        userId,
        agentId,
        rootAgentId: agentId,
        sourceType: 'chat',
        sourceId: conversationId,
        model: meta.model,
        usage: extractTotalUsage(result),
      })
    }

    let persistedMessages = result.uiMessages ?? []
    if (
      didReachStepLimit({
        ...stepLimitInput,
        steps: result.steps,
      })
    ) {
      const notice = buildStepLimitNotice(stepLimitInput)
      await emitActivity(
        sessionRunId,
        'Chat: Step limit reached, finalizing early',
        {
          conversationId,
          stepLimit: resolveStepLimitCount(stepLimitInput),
        }
      )
      await emitChatStatus({
        message: 'Step limit reached, finalizing the turn...',
        phase: 'agent-stream',
        replyToken,
      })
      await writeAssistantNotice(
        replyToken,
        formatStepLimitStreamText(result.uiMessages ?? [], notice)
      )
      persistedMessages = appendStepLimitNoticeToMessages(
        persistedMessages,
        notice
      )
    }

    await finishUiMessageStream(replyToken)
    streamClosed = true

    await persistAssistantTurn({
      agentId,
      conversationId,
      uiMessages: persistedMessages,
    })
    await emitActivity(sessionRunId, 'Chat: Response saved', { conversationId })
  } catch (error) {
    await streamPromise.catch(() => {
      // Let the agent stream settle before forcing a manual close.
    })
    throw error
  } finally {
    if (!streamClosed) {
      await finishUiMessageStream(replyToken).catch(() => {
        // Best-effort close so client streams do not hang on failures.
      })
    }
  }
}

async function currentSessionRunId(fallback: string): Promise<string> {
  'use step'
  await Promise.resolve()
  try {
    const metadata = getWorkflowMetadata() as {
      runId?: string
      workflowRunId?: string
    }
    return metadata.runId ?? metadata.workflowRunId ?? fallback
  } catch {
    return fallback
  }
}

function formatStepLimitStreamText(
  messages: readonly UIMessage[],
  notice: string
): string {
  const lastMessage = messages.at(-1)
  const hasAssistantText =
    lastMessage?.role === 'assistant' &&
    lastMessage.parts.some(
      (part) => part.type === 'text' && part.text.trim().length > 0
    )
  return `${hasAssistantText ? '\n\n' : ''}${notice}`
}

function createAssistantNoticeMessage(id: string, notice: string): UIMessage {
  return {
    id,
    role: 'assistant',
    parts: [{ type: 'text', text: notice }],
  }
}

async function writeAssistantNotice(
  replyToken: string,
  notice: string
): Promise<void> {
  'use step'
  const writable = getWritable<UIMessageChunk>({
    namespace: replyToken,
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

async function finishUiMessageStream(replyToken: string): Promise<void> {
  'use step'
  const writable = getWritable<UIMessageChunk>({
    namespace: replyToken,
  })
  const writer = writable.getWriter()
  try {
    await writer.write({ type: 'finish' })
  } finally {
    writer.releaseLock()
  }
  await writable.close()
}
