import { getWritable } from "workflow"
import { FatalError } from "workflow"
import {
  convertToModelMessages,
  type UIMessage,
  type UIMessageChunk,
} from "ai"
import { startupAgentSandbox } from "@/lib/agent-sandbox"
import { getAgentRuntime } from "@/lib/agent-runtime-registry"
import type { AgentKind } from "@/lib/db/schema"
import { maybeGenerateConversationTitle } from "@/workflows/chat/steps/generate-conversation-title"
import { persistAssistantTurn } from "@/workflows/chat/steps/persist-assistant-turn"

/**
 * Chat event handler — runs inside the long-lived session workflow.
 *
 *   1. Resume the agent's persistent sandbox by name (booted on first
 *      use, snapshotted by `endOfEvent` after this handler returns).
 *   2. Build the per-kind `DurableAgent` via the runtime registry.
 *   3. Stream the turn into a per-turn namespaced sub-stream of the
 *      session workflow's run, keyed by `replyStreamToken`. The HTTP
 *      route on the other end pipes that sub-stream straight into
 *      `createUIMessageStreamResponse` so the UI never sees the
 *      session shape.
 *   4. Generate the conversation title (first turn only) in parallel
 *      with the agent stream so user-visible latency is never gated by
 *      titling.
 *   5. Persist the assistant turn.
 *
 * No `"use step"` here — the body uses workflow primitives
 * (`getWritable`, `DurableAgent.stream`) and lives in the workflow
 * sandbox. Tool execute functions inside the agent are individually
 * marked `"use step"` for Node access where they need it.
 */
export async function handleChat(input: {
  agentId: string
  kind: AgentKind
  conversationId: string
  replyToken: string
  uiMessages: UIMessage[]
}): Promise<void> {
  const { agentId, kind, conversationId, replyToken, uiMessages } = input

  const writable = getWritable<UIMessageChunk>({
    namespace: replyToken,
  })

  await startupAgentSandbox({ agentId })

  const runtime = getAgentRuntime(kind)
  if (!runtime?.buildAgent) {
    throw new FatalError(
      `Agent kind "${kind}" has no chat agent registered.`,
    )
  }

  const agent = runtime.buildAgent({
    runId: conversationId,
    agentId,
  })

  const modelMessages = await convertToModelMessages(uiMessages)

  const [, result] = await Promise.all([
    maybeGenerateConversationTitle({
      agentId,
      conversationId,
      uiMessages,
    }),
    agent.stream({
      messages: modelMessages,
      writable,
      maxSteps: 40,
      collectUIMessages: true,
    }),
  ])

  await persistAssistantTurn({
    agentId,
    conversationId,
    uiMessages: result.uiMessages ?? [],
  })
}
