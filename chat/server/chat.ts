import 'server-only'
import type { UIMessage } from 'ai'
import { and, asc, desc, eq, isNull, or, sql } from 'drizzle-orm'
import { cacheLife, cacheTag } from 'next/cache'
import { db } from '@/shared/db'
import {
  type ChatConversation,
  type ChatMessage,
  type ChatRole,
  chatConversation,
  chatMessage,
} from '@/shared/db/schema'
import { conversationListTag } from '@/shared/server/cache-tags'

const PLACEHOLDER_CHAT_TITLE = 'new chat'
const WHITESPACE_PATTERN = '\\s+'

export function newChatConversationId() {
  return (
    'cc_' +
    Math.random().toString(36).slice(2) +
    Date.now().toString(36).slice(-4)
  )
}

// Draft `/chat/new` routes stay DB-free until the first user message creates the row.
// Re-selecting after `ON CONFLICT DO NOTHING` keeps retries race-safe and agent-scoped.
export async function getOrCreateConversationForAgent(
  conversationId: string,
  agentId: string
): Promise<ChatConversation | null> {
  const [existing] = await db
    .select()
    .from(chatConversation)
    .where(
      and(
        eq(chatConversation.id, conversationId),
        eq(chatConversation.agentId, agentId)
      )
    )
    .limit(1)
  if (existing) {
    return existing
  }

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
        eq(chatConversation.agentId, agentId)
      )
    )
    .limit(1)
  return row ?? null
}

export async function getConversationForAgent(
  conversationId: string,
  agentId: string
): Promise<ChatConversation | null> {
  const [row] = await db
    .select()
    .from(chatConversation)
    .where(
      and(
        eq(chatConversation.id, conversationId),
        eq(chatConversation.agentId, agentId)
      )
    )
    .limit(1)
  return row ?? null
}

export async function getMostRecentConversationForAgent(
  agentId: string
): Promise<ChatConversation | null> {
  const [row] = await db
    .select()
    .from(chatConversation)
    .where(eq(chatConversation.agentId, agentId))
    .orderBy(desc(chatConversation.updatedAt))
    .limit(1)
  return row ?? null
}

export async function listConversationsForAgent(
  agentId: string
): Promise<ChatConversation[]> {
  return await db
    .select()
    .from(chatConversation)
    .where(eq(chatConversation.agentId, agentId))
    .orderBy(desc(chatConversation.updatedAt))
}

export async function getCachedConversationListForAgent(
  agentId: string
): Promise<ChatConversation[]> {
  'use cache'

  cacheLife('minutes')
  cacheTag(conversationListTag(agentId))
  return await listConversationsForAgent(agentId)
}

export async function renameConversation(
  conversationId: string,
  agentId: string,
  title: string
): Promise<ChatConversation | null> {
  const trimmed = title.trim().slice(0, 80)
  if (!trimmed) {
    return null
  }
  const [row] = await db
    .update(chatConversation)
    .set({ title: trimmed, updatedAt: new Date() })
    .where(
      and(
        eq(chatConversation.id, conversationId),
        eq(chatConversation.agentId, agentId)
      )
    )
    .returning()
  return row ?? null
}

export async function deleteConversation(
  conversationId: string,
  agentId: string
): Promise<boolean> {
  const rows = await db
    .delete(chatConversation)
    .where(
      and(
        eq(chatConversation.id, conversationId),
        eq(chatConversation.agentId, agentId)
      )
    )
    .returning({ id: chatConversation.id })
  return rows.length > 0
}

// Treat the generated placeholder as unset so greeting-only first turns do not
// permanently block a later substantive title. Other user edits still win.
export async function setConversationTitleIfUnset(
  conversationId: string,
  title: string
): Promise<void> {
  const trimmed = title.trim().slice(0, 80)
  if (!trimmed) {
    return
  }
  await db
    .update(chatConversation)
    .set({ title: trimmed })
    .where(
      and(
        eq(chatConversation.id, conversationId),
        or(
          isNull(chatConversation.title),
          sql`lower(trim(regexp_replace(${chatConversation.title}, ${WHITESPACE_PATTERN}, ' ', 'g'))) = ${PLACEHOLDER_CHAT_TITLE}`
        )
      )
    )
}

export async function loadChatHistory(
  conversationId: string
): Promise<UIMessage[]> {
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
    role: row.role as UIMessage['role'],
    parts: row.parts as UIMessage['parts'],
    metadata: row.metadata ?? undefined,
  }
}

// Idempotent insert helper for retryable turn persistence. Returns false when
// the message id already exists and the row was left untouched.
export async function insertChatMessage(input: {
  createdAt?: Date
  conversationId: string
  id: string
  role: ChatRole
  parts: UIMessage['parts']
  metadata?: unknown
}): Promise<boolean> {
  return await insertChatMessageIfNew(input)
}

export async function insertChatMessageIfNew(input: {
  createdAt?: Date
  conversationId: string
  id: string
  role: ChatRole
  parts: UIMessage['parts']
  metadata?: unknown
}): Promise<boolean> {
  const inserted = await db
    .insert(chatMessage)
    .values({
      id: input.id,
      conversationId: input.conversationId,
      role: input.role,
      parts: input.parts,
      metadata: input.metadata ?? null,
      createdAt: input.createdAt,
    })
    .onConflictDoNothing({ target: chatMessage.id })
    .returning({ id: chatMessage.id })

  if (inserted.length === 0) {
    return false
  }

  await db
    .update(chatConversation)
    .set({ updatedAt: new Date() })
    .where(eq(chatConversation.id, input.conversationId))

  return true
}

// Diff by message id so workflow retries do not double-insert chat turns.
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
    if (seen.has(m.id)) {
      continue
    }
    await insertChatMessage({
      conversationId: input.conversationId,
      id: m.id,
      role: m.role as ChatRole,
      parts: m.parts,
      metadata: m.metadata,
    })
  }
}
