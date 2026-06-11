import 'server-only'

import {
  getConversationForAgent,
  loadChatHistory,
} from '@outname/ai/chat/server/chat'
import { getCachedAgentByIdForUser } from '@outname/shared/server/data'
import type { UIMessage } from 'ai'

type LoadConversationPageDataInput = {
  agentId: string
  conversationId: string
  userId: string
}

type ConversationPageData = {
  agentId: string
  conversationId: string
  initialMessages: UIMessage[]
}

export async function loadConversationPageData(
  input: LoadConversationPageDataInput
): Promise<ConversationPageData | null> {
  const agent = await getCachedAgentByIdForUser(input.agentId, input.userId)
  if (!agent) {
    return null
  }

  const conversation = await getConversationForAgent(
    input.conversationId,
    agent.id
  )
  if (!conversation) {
    return null
  }

  const initialMessages = await loadChatHistory(conversation.id)
  return {
    agentId: agent.id,
    conversationId: conversation.id,
    initialMessages,
  }
}
