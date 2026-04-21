import "server-only"
import { and, asc, desc, eq, isNull } from "drizzle-orm"
import type { UIMessage } from "ai"
import { db } from "@/lib/db"
import {
  chatConversation,
  chatMessage,
  type ChatConversation,
  type ChatMessage,
  type ChatRole,
} from "@/lib/db/schema"

/**
 * Stable id generator for chat conversations. Matches the existing
 * "prefix_random" convention used elsewhere in the app so ids remain
 * recognisable when browsing the DB.
 */
export function newChatConversationId() {
  return (
    "cc_" +
    Math.random().toString(36).slice(2) +
    Date.now().toString(36).slice(-4)
  )
}

/**
 * Look up a conversation by id, scoped to its agent — or create it if
 * missing. This is the **only** write path used during normal chatting:
 * the `/chat/new` route generates a candidate id but does not touch the
 * DB, so empty drafts are never persisted. A row only comes into
 * existence when the first user message actually arrives at
 * `POST /api/agents/:id/chat`.
 *
 * `INSERT … ON CONFLICT (id) DO NOTHING` + an owner-scoped re-select
 * keeps this race-safe under double-submit and immune to hijacking:
 * supplying someone else's id will simply not find a matching row and
 * return null.
 */
export async function getOrCreateConversationForAgent(
  conversationId: string,
  agentId: string,
): Promise<ChatConversation | null> {
  const [existing] = await db
    .select()
    .from(chatConversation)
    .where(
      and(
        eq(chatConversation.id, conversationId),
        eq(chatConversation.agentId, agentId),
      ),
    )
    .limit(1)
  if (existing) return existing

  await db
    .insert(chatConversation)
    .values({ id: conversationId, agentId })
    .onConflictDoNothing({ target: chatConversation.id })

  const [row] = await db
    .select()
    .from(chatConversation)
    .where(
      and(
        eq(chatConversation.id, conversationId),
        eq(chatConversation.agentId, agentId),
      ),
    )
    .limit(1)
  return row ?? null
}

/**
 * Owner-scoped read used by `chat/[conversationId]/page.tsx`. Returns
 * null if the conversation does not exist or belongs to another agent.
 */
export async function getConversationForAgent(
  conversationId: string,
  agentId: string,
): Promise<ChatConversation | null> {
  const [row] = await db
    .select()
    .from(chatConversation)
    .where(
      and(
        eq(chatConversation.id, conversationId),
        eq(chatConversation.agentId, agentId),
      ),
    )
    .limit(1)
  return row ?? null
}

/**
 * Most recently touched conversation for an agent. Used by the chat
 * landing redirect so users come back to their last active thread.
 */
export async function getMostRecentConversationForAgent(
  agentId: string,
): Promise<ChatConversation | null> {
  const [row] = await db
    .select()
    .from(chatConversation)
    .where(eq(chatConversation.agentId, agentId))
    .orderBy(desc(chatConversation.updatedAt))
    .limit(1)
  return row ?? null
}

/**
 * Full list for the sidebar, newest first. Served by the
 * `(agent_id, updated_at DESC)` index so it stays O(log n) as history
 * grows.
 */
export async function listConversationsForAgent(
  agentId: string,
): Promise<ChatConversation[]> {
  return db
    .select()
    .from(chatConversation)
    .where(eq(chatConversation.agentId, agentId))
    .orderBy(desc(chatConversation.updatedAt))
}

/**
 * Rename a conversation. Owner-scoped via the `(id, agent_id)` match so
 * clients cannot rename conversations that belong to other agents even
 * if they somehow guess an id.
 */
export async function renameConversation(
  conversationId: string,
  agentId: string,
  title: string,
): Promise<ChatConversation | null> {
  const trimmed = title.trim().slice(0, 80)
  if (!trimmed) return null
  const [row] = await db
    .update(chatConversation)
    .set({ title: trimmed, updatedAt: new Date() })
    .where(
      and(
        eq(chatConversation.id, conversationId),
        eq(chatConversation.agentId, agentId),
      ),
    )
    .returning()
  return row ?? null
}

/**
 * Delete a conversation and (via cascade FK) all of its messages.
 * Returns true if a row was deleted.
 */
export async function deleteConversation(
  conversationId: string,
  agentId: string,
): Promise<boolean> {
  const rows = await db
    .delete(chatConversation)
    .where(
      and(
        eq(chatConversation.id, conversationId),
        eq(chatConversation.agentId, agentId),
      ),
    )
    .returning({ id: chatConversation.id })
  return rows.length > 0
}

/**
 * Set the conversation title only when it is still NULL. This is the
 * guard used by the title-generation workflow step: later turns never
 * overwrite a title the user (or a previous pass) has already set, and
 * concurrent runs cannot stomp on each other.
 */
export async function setConversationTitleIfUnset(
  conversationId: string,
  title: string,
): Promise<void> {
  const trimmed = title.trim().slice(0, 80)
  if (!trimmed) return
  await db
    .update(chatConversation)
    .set({ title: trimmed })
    .where(
      and(
        eq(chatConversation.id, conversationId),
        isNull(chatConversation.title),
      ),
    )
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
