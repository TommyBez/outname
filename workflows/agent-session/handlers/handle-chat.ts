import { convertToModelMessages, type UIMessage, type UIMessageChunk } from 'ai'
import { getWorkflowMetadata, getWritable } from 'workflow'
import { startupExecSandbox, startupSystemSandbox } from '@/lib/agent-sandbox'
import { emitActivity } from '@/lib/run-events'
import { maybeGenerateConversationTitle } from '@/workflows/chat/steps/generate-conversation-title'
import { persistAssistantTurn } from '@/workflows/chat/steps/persist-assistant-turn'
import { buildAgent } from '../agent-factory'
import { resolveStepLimit } from '../step-limit'
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

  const { agent, meta, pending } = await buildAgent({
    agentId,
    runId: conversationId,
    currentRunId: sessionRunId,
    conversationId,
  })

  const modelMessages = await convertToModelMessages(uiMessages)
  await emitActivity(sessionRunId, 'Chat: Streaming model response', {
    model: meta.model,
  })

  await emitChatStatus({
    message: 'Connecting to the agent...',
    phase: 'agent-stream',
    replyToken,
  })
  const [, result] = await Promise.all([
    maybeGenerateConversationTitle({
      agentId,
      conversationId,
      uiMessages,
    }),
    agent.stream({
      messages: modelMessages,
      writable,
      stopWhen: resolveStepLimit({
        mode: meta.stepLimitMode,
        custom: meta.stepLimitCustom,
      }),
      collectUIMessages: true,
    }),
  ])

  await persistAssistantTurn({
    agentId,
    conversationId,
    uiMessages: result.uiMessages ?? [],
  })
  await emitActivity(sessionRunId, 'Chat: Response saved', { conversationId })

  return { pending }
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
