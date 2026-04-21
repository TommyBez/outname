import type { UIMessage } from "ai"
import { persistNewChatMessages } from "@/lib/agent-chat"

/**
 * Post-stream persistence step.
 *
 * The chat workflow streams UIMessageChunks live to the client via
 * `getWritable`, then hands the accumulated UIMessages to this step so
 * the assistant turn (and any new user message parts the agent chose to
 * include) land in Postgres.
 *
 * Kept as its own `"use step"` so the DB write participates in the
 * workflow's durability / retry semantics — failures to persist are
 * independently retried and do not silently corrupt the transcript.
 */
export async function persistAssistantTurn(input: {
  conversationId: string
  uiMessages: UIMessage[]
}): Promise<void> {
  "use step"
  await persistNewChatMessages(input)
}
