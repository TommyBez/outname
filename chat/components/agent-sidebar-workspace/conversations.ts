import { mutate as swrMutate } from 'swr'

export interface ConversationSummary {
  id: string
  title: string | null
  updatedAt: string
}

export function conversationsSwrKey(agentId: string): string {
  return `/api/agents/${agentId}/conversations`
}

export function revalidateConversations(agentId: string) {
  return swrMutate(conversationsSwrKey(agentId))
}

export async function fetchConversations(
  url: string
): Promise<ConversationSummary[]> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to load conversations (${response.status})`)
  }
  const data = (await response.json()) as {
    conversations: ConversationSummary[]
  }
  return data.conversations
}
