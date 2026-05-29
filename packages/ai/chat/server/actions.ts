'use server'

import {
  deleteConversation,
  getConversationForAgent,
  renameConversation,
} from '@outname/ai/chat/server/chat'
import { requireSession } from '@outname/auth/server/auth-guard'
import { conversationListTag } from '@outname/shared/server/cache-tags'
import { getAgentByIdForUser } from '@outname/shared/server/data'
import { updateTag } from 'next/cache'
import { redirect } from 'next/navigation'

interface ActionResult {
  error?: string
  ok: boolean
}

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
