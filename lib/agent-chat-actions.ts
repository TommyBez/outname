'use server'

import { updateTag } from 'next/cache'
import { redirect } from 'next/navigation'
import {
  deleteConversation,
  getConversationForAgent,
  renameConversation,
} from '@/lib/agent-chat'
import { requireSession } from '@/lib/auth-guard'
import { conversationListTag } from '@/lib/cache-tags'
import { getAgentByIdForUser } from '@/lib/data'

interface ActionResult {
  error?: string
  ok: boolean
}

/**
 * Rename a chat conversation owned by the current user's agent. Called
 * from the sidebar's inline rename UI. Returns a serialisable result so
 * the client can surface validation errors without throwing.
 */
export async function renameConversationAction(input: {
  agentId: string
  conversationId: string
  title: string
}): Promise<ActionResult> {
  const session = await requireSession()
  const agent = await getAgentByIdForUser(input.agentId, session.user.id)
  if (!agent) {
    return { ok: false, error: 'Agent not found.' }
  }

  const trimmed = input.title.trim()
  if (!trimmed) {
    return { ok: false, error: 'Title cannot be empty.' }
  }
  if (trimmed.length > 80) {
    return { ok: false, error: 'Title must be 80 characters or fewer.' }
  }

  const row = await renameConversation(input.conversationId, agent.id, trimmed)
  if (!row) {
    return { ok: false, error: 'Conversation not found.' }
  }

  updateTag(conversationListTag(agent.id))
  return { ok: true }
}

/**
 * Delete a chat conversation. If the deleted conversation was the one
 * the user is currently viewing, we redirect them back to the chat
 * landing route (which will redirect again to the newest remaining
 * conversation, or to `/chat/new` if none remain).
 */
export async function deleteConversationAction(input: {
  agentId: string
  conversationId: string
  wasActive?: boolean
}): Promise<ActionResult> {
  const session = await requireSession()
  const agent = await getAgentByIdForUser(input.agentId, session.user.id)
  if (!agent) {
    return { ok: false, error: 'Agent not found.' }
  }

  const existing = await getConversationForAgent(input.conversationId, agent.id)
  if (!existing) {
    return { ok: false, error: 'Conversation not found.' }
  }

  await deleteConversation(input.conversationId, agent.id)
  updateTag(conversationListTag(agent.id))

  if (input.wasActive) {
    redirect(`/agents/${agent.id}/chat`)
  }
  return { ok: true }
}
