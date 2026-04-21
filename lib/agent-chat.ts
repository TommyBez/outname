import "server-only"
import { asc, eq } from "drizzle-orm"
import type { UIMessage } from "ai"
import { db } from "@/lib/db"
import {
  chatConversation,
  chatMessage,
  type ChatMessage,
  type ChatRole,
} from "@/lib/db/schema"

function newId(prefix: string) {
  return prefix + "_" + Math.random().toString(36).slice(2) + Date.now().toString(36).slice(-4)
}

/**
 * Return the single chat conversation for this agent, creating it on
 * first use. The UNIQUE index on (agent_id) enforces the 1:1 invariant,
 * and `ON CONFLICT DO NOTHING` makes this idempotent under concurrent
 * first-message races.
 */
export async function ensureConversationForAgent(agentId: string): Promise<string> {
  const [existing] = await db
    .select({ id: chatConversation.id })
    .from(chatConversation)
    .where(eq(chatConversation.agentId, agentId))
    .limit(1)
  if (existing) return existing.id

  const id = newId("cc")
  await db
    .insert(chatConversation)
    .values({ id, agentId })
    .onConflictDoNothing({ target: chatConversation.agentId })

  // Re-read in case we lost the race to a concurrent insert.
  const [row] = await db
    .select({ id: chatConversation.id })
    .from(chatConversation)
    .where(eq(chatConversation.agentId, agentId))
    .limit(1)
  if (!row) throw new Error("failed to create chat conversation")
  return row.id
}

/**
 * Load the full message history for a conversation, oldest first, in the
 * UIMessage shape expected by the AI SDK and `useChat`.
 */
export async function loadChatHistory(conversationId: string): Promise<UIMessage[]> {
  const rows = await db
    .select()
    .from(chatMessage)
    .where(eq(chatMessage.conversationId, conversationId))
    .orderBy(asc(chatMessage.createdAt))
  return rows.map(rowToUIMessage)
}

function rowToUIMessage(row: ChatMessage): UIMessage {
  return {
    id: row.id,
    role: row.role as UIMessage["role"],
    parts: row.parts as UIMessage["parts"],
    metadata: row.metadata ?? undefined,
  }
}

/**
 * Persist a single chat message row. Used by the API route for the user
 * message at turn start, and by the chat workflow for assistant turns
 * after streaming completes.
 */
export async function insertChatMessage(input: {
  conversationId: string
  id: string
  role: ChatRole
  parts: UIMessage["parts"]
  metadata?: unknown
}): Promise<void> {
  await db
    .insert(chatMessage)
    .values({
      id: input.id,
      conversationId: input.conversationId,
      role: input.role,
      parts: input.parts,
      metadata: input.metadata ?? null,
    })
    .onConflictDoNothing({ target: chatMessage.id })

  await db
    .update(chatConversation)
    .set({ updatedAt: new Date() })
    .where(eq(chatConversation.id, input.conversationId))
}

/**
 * Persist every UIMessage produced during a chat turn that is newer than
 * what was already stored. The workflow captures `uiMessages` via
 * `collectUIMessages: true` and hands them to this helper; we diff by
 * message id so re-runs or retries don't double-insert.
 */
export async function persistNewChatMessages(input: {
  conversationId: string
  uiMessages: UIMessage[]
}): Promise<void> {
  const existing = await db
    .select({ id: chatMessage.id })
    .from(chatMessage)
    .where(eq(chatMessage.conversationId, input.conversationId))
  const seen = new Set(existing.map((r) => r.id))

  for (const m of input.uiMessages) {
    if (seen.has(m.id)) continue
    await insertChatMessage({
      conversationId: input.conversationId,
      id: m.id,
      role: m.role as ChatRole,
      parts: m.parts,
      metadata: m.metadata,
    })
  }
}
