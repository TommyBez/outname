import { getWritable } from "workflow"
import { FatalError } from "workflow"
import {
  convertToModelMessages,
  type UIMessage,
  type UIMessageChunk,
} from "ai"
import {
  shutdownAgentSandbox,
  startupAgentSandbox,
} from "@/lib/agent-sandbox"
import { getAgentRuntime } from "@/lib/agent-runtime-registry"
import type { AgentKind } from "@/lib/db/schema"
import { maybeGenerateConversationTitle } from "./steps/generate-conversation-title"
import { persistAssistantTurn } from "./steps/persist-assistant-turn"

/**
 * Generic chat workflow shared by every agent kind.
 *
 * Lifecycle per user turn:
 *   1. startupAgentSandbox — same primitive the cron workflow uses.
 *      Kind-specific setup (creds, binaries) is looked up in
 *      `lib/agent-sandbox-registry.ts`.
 *   2. Build the DurableAgent via the per-kind factory registered in
 *      `lib/agent-runtime-registry.ts`. The exact same factory that
 *      powers cron runs — one agent definition per kind, full stop.
 *   3. Stream the turn. Output flows through `getWritable` to the HTTP
 *      response via `createUIMessageStreamResponse` on the route side.
 *   4. persistAssistantTurn — save the accumulated UIMessages so the
 *      thread rehydrates correctly on next page load.
 *   5. shutdownAgentSandbox — always runs via `finally` so we never leak
 *      sandboxes.
 *
 * This workflow is deliberately tool-agnostic. Adding a new agent kind
 * never requires editing this file.
 */
export async function agentChat(input: {
  kind: AgentKind
  agentId: string
  conversationId: string
  uiMessages: UIMessage[]
}) {
  "use workflow"

  const { kind, agentId, conversationId, uiMessages } = input

  const writable = getWritable<UIMessageChunk>()

  await startupAgentSandbox({ agentId })

  try {
    const runtime = getAgentRuntime(kind)
    if (!runtime?.buildAgent) {
      throw new FatalError(`Agent kind "${kind}" has no chat agent registered.`)
    }

    const agent = runtime.buildAgent({
      runId: conversationId,
      agentId,
    })

    const modelMessages = await convertToModelMessages(uiMessages)

    // Kick off title generation in parallel with the stream. On a
    // brand-new conversation the title step runs the nano model against
    // the first user message; on later turns it's a no-op guarded by
    // `WHERE title IS NULL`. Running in parallel means titling latency
    // never gates the user-visible stream.
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

    return { conversationId }
  } finally {
    await shutdownAgentSandbox({ agentId })
  }
}
