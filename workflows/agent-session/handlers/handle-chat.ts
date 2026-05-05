import { convertToModelMessages, type UIMessage, type UIMessageChunk } from 'ai'
import { getWorkflowMetadata, getWritable } from 'workflow'
import { compactSubAgentToolOutputsForModel } from '@/lib/agent-chat-model'
import { startupExecSandbox, startupSystemSandbox } from '@/lib/agent-sandbox'
import { emitActivity } from '@/lib/run-events'
import { maybeGenerateConversationTitle } from '@/workflows/chat/steps/generate-conversation-title'
import { persistAssistantTurn } from '@/workflows/chat/steps/persist-assistant-turn'
import { buildAgent } from '../agent-factory'
import {
  appendStepLimitNoticeToMessages,
  buildStepLimitNotice,
  didReachStepLimit,
  resolveStepLimit,
  resolveStepLimitCount,
} from '../step-limit'
import { drainPendingWrites } from '../steps/drain-pending-writes'
import { emitChatStatus } from '../steps/emit-chat-status'
import type { PendingWrites } from '../tools/pending-writes'

/**
 * Chat event handler — runs inside the long-lived session workflow.
 *
 *   1. Boot both sandboxes for this event:
 *        - system (memory volume + bootstrap files) — required, used by
 *          composeSystemPrompt and the memory_* tools.
 *        - exec   (clean /workspace) — best-effort; if it fails we log
 *          and proceed so the agent can still answer text-only turns.
 *      `endOfEvent` snapshots both at turn end.
 *   2. Build the per-event `DurableAgent` via `buildAgent`. The same
 *      factory is used by `handleHeartbeat`.
 *   3. Stream the turn into a per-turn namespaced sub-stream of the
 *      session workflow's run, keyed by `replyToken`. The HTTP route
 *      on the other end pipes that sub-stream straight into
 *      `createUIMessageStreamResponse` so the UI never sees the
 *      session shape.
 *   4. Generate the conversation title (first turn only) in parallel
 *      with the agent stream so user-visible latency is never gated by
 *      titling.
 *   5. Persist the assistant turn.
 *   6. Return the per-event `pending` queue so the session workflow
 *      can hand it to `endOfEvent` for flushing. If we threw before
 *      reaching this return, the queue is dropped — atomicity at the
 *      turn boundary, not the tool-call boundary.
 *
 * No `"use step"` here — the body uses workflow primitives
 * (`getWritable`, `DurableAgent.stream`) and lives in the workflow
 * sandbox. Tool execute functions inside the agent are individually
 * marked `"use step"` for sandbox/Node access where they need it.
 */
export async function handleChat(input: {
  agentId: string
  conversationId: string
  replyToken: string
  uiMessages: UIMessage[]
}): Promise<{ pending: PendingWrites }> {
  const { agentId, conversationId, replyToken, uiMessages } = input
  const sessionRunId = await currentSessionRunId(conversationId)

  const writable = getWritable<UIMessageChunk>({
    namespace: replyToken,
  })

  await emitActivity(sessionRunId, 'Chat: Preparing response', {
    conversationId,
  })
  await startupSystemSandbox({ agentId })
  await emitChatStatus({
    message: 'Starting execution sandbox...',
    phase: 'exec-sandbox',
    replyToken,
  })
  await startupExecSandbox({ agentId }).catch((err) => {
    // Don't kill the chat turn if the exec sandbox can't boot — the
    // agent can still answer text-only turns. The exec_* tools will
    // surface clearer errors per-call when they try to use it.
    console.error('[v0] handleChat: startupExecSandbox failed', err)
  })

  // Apply any UI-authored bootstrap-file edits before composing the
  // system prompt. composeSystemPrompt inlines AGENTS.md / IDENTITY.md /
  // SOUL.md verbatim, so this guarantees the operator's latest save is
  // what the model sees this turn.
  await emitActivity(sessionRunId, 'Chat: Syncing memory edits')
  await drainPendingWrites({ agentId })

  const { agent, meta, pending, tools } = await buildAgent({
    agentId,
    runId: conversationId,
    currentRunId: sessionRunId,
    conversationId,
    streamNamespace: replyToken,
  })

  const modelMessages = await convertToModelMessages(
    compactSubAgentToolOutputsForModel(uiMessages),
    { tools }
  )
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
    messages: modelMessages,
    writable,
    stopWhen: resolveStepLimit(stepLimitInput),
    collectUIMessages: true,
    preventClose: true,
    sendFinish: false,
  })
  let streamClosed = false
  try {
    const [, result] = await Promise.all([titlePromise, streamPromise])

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

    return { pending }
  } catch (error) {
    await streamPromise.catch(() => {
      // Wait for the agent stream to settle before we manually finish it.
    })
    throw error
  } finally {
    if (!streamClosed) {
      await finishUiMessageStream(replyToken).catch(() => {
        // Best-effort close so the client stream does not hang on failures.
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
