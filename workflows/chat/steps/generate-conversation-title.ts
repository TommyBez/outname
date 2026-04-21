import { generateText } from "ai"
import type { UIMessage } from "ai"
import {
  getConversationForAgent,
  setConversationTitleIfUnset,
} from "@/lib/agent-chat"

/**
 * Extract a plain-text preview from a UIMessage by concatenating its
 * text parts. Non-text parts (tool calls, reasoning, files) are ignored
 * for titling purposes — the title should reflect what the user actually
 * typed, not attached context.
 */
function extractText(message: UIMessage | undefined): string {
  if (!message) return ""
  const parts = message.parts ?? []
  const chunks: string[] = []
  for (const part of parts) {
    if (part.type === "text" && typeof part.text === "string") {
      chunks.push(part.text)
    }
  }
  return chunks.join("\n").trim()
}

/**
 * Generate and persist a short title for a conversation based on the
 * user's first message. Runs as its own `"use step"` so it participates
 * in workflow durability + retry, and so the slow path (LLM call) does
 * not block the assistant stream when wired in parallel.
 *
 * Guarantees:
 *   - No-op if the conversation already has a title (owner of the
 *     conversation may have already renamed it, or a prior run already
 *     set it). Enforced by the `WHERE title IS NULL` guard inside
 *     `setConversationTitleIfUnset`.
 *   - No-op if there is no user text to summarise.
 *   - Never throws: on LLM failure we fall back to a truncated version
 *     of the first user message so the sidebar always has something
 *     meaningful to display.
 */
export async function maybeGenerateConversationTitle(input: {
  agentId: string
  conversationId: string
  uiMessages: UIMessage[]
}): Promise<void> {
  "use step"

  const conversation = await getConversationForAgent(
    input.conversationId,
    input.agentId,
  )
  if (!conversation) return
  if (conversation.title) return

  const firstUserMessage = input.uiMessages.find((m) => m.role === "user")
  const firstUserText = extractText(firstUserMessage)
  if (!firstUserText) return

  // The prompt is intentionally tight: we want a short noun-phrase
  // title, never a sentence, and never wrapped in quotes.
  const fallback = firstUserText.slice(0, 60).trim() || "New chat"

  try {
    const { text } = await generateText({
      model: "openai/gpt-5.4-nano",
      system: [
        "You name chat conversations.",
        "Return a concise 3-6 word title summarising what the user is asking.",
        "Use title case. No quotes. No trailing punctuation.",
        "If the message is greeting-only, respond with 'New Chat'.",
      ].join("\n"),
      prompt: firstUserText.slice(0, 2000),
    })

    const cleaned = text
      .replace(/^["'`]+|["'`]+$/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 80)

    await setConversationTitleIfUnset(
      input.conversationId,
      cleaned || fallback,
    )
  } catch {
    await setConversationTitleIfUnset(input.conversationId, fallback)
  }
}
