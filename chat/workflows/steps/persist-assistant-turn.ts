import type { UIMessage } from 'ai'
import { revalidateTag } from 'next/cache'
import { persistNewChatMessages } from '@/chat/server/chat'
import { conversationListTag } from '@/shared/server/cache-tags'

export async function persistAssistantTurn(input: {
  agentId: string
  conversationId: string
  uiMessages: UIMessage[]
}): Promise<void> {
  'use step'
  await persistNewChatMessages(input)
  revalidateTag(conversationListTag(input.agentId), 'max')
}
