import 'server-only'
import type { UIMessage } from 'ai'
import { and, asc, desc, eq, isNull, or, sql } from 'drizzle-orm'
import { cacheLife, cacheTag } from 'next/cache'
import { stripIncompleteToolPartsForModel } from '@/chat/lib/incomplete-tool-parts'
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

export type ChatMessageWriteResult = 'inserted' | 'updated' | 'unchanged'

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
  return stripIncompleteToolPartsForModel(rows.map(rowToUIMessage))
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

  await touchConversation(input.conversationId)
  return true
}

export async function upsertChatMessage(input: {
  createdAt?: Date
  conversationId: string
  id: string
  role: ChatRole
  parts: UIMessage['parts']
  metadata?: unknown
}): Promise<ChatMessageWriteResult> {
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

  if (inserted.length > 0) {
    await touchConversation(input.conversationId)
    return 'inserted'
  }

  const [existing] = await db
    .select({
      conversationId: chatMessage.conversationId,
      metadata: chatMessage.metadata,
      parts: chatMessage.parts,
      role: chatMessage.role,
    })
    .from(chatMessage)
    .where(eq(chatMessage.id, input.id))
    .limit(1)
  if (!existing) {
    throw new Error(`upsertChatMessage: message ${input.id} disappeared`)
  }
  if (existing.conversationId !== input.conversationId) {
    throw new Error(
      `upsertChatMessage: message ${input.id} belongs to another conversation`
    )
  }

  const nextMetadata = input.metadata ?? null
  const unchanged =
    existing.role === input.role &&
    stableJson(existing.parts) === stableJson(input.parts) &&
    stableJson(existing.metadata) === stableJson(nextMetadata)
  if (unchanged) {
    return 'unchanged'
  }

  await db
    .update(chatMessage)
    .set({
      role: input.role,
      parts: input.parts,
      metadata: nextMetadata,
    })
    .where(eq(chatMessage.id, input.id))
  await touchConversation(input.conversationId)
  return 'updated'
}

async function touchConversation(conversationId: string): Promise<void> {
  await db
    .update(chatConversation)
    .set({ updatedAt: new Date() })
    .where(eq(chatConversation.id, conversationId))
}

function stableJson(value: unknown): string {
  return JSON.stringify(sortJson(value)) ?? 'undefined'
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortJson)
  }
  if (!isPlainObject(value)) {
    return value
  }
  const sorted: Record<string, unknown> = {}
  for (const key of Object.keys(value).sort()) {
    sorted[key] = sortJson(value[key])
  }
  return sorted
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    Object.getPrototypeOf(value) === Object.prototype
  )
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
