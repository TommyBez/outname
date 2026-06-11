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

/**
 * Inserts a just-created conversation into the sidebar cache immediately so
 * the user sees it without waiting for the server round trip; the real row
 * (with its generated title) replaces it on the next revalidation.
 */
export function optimisticallyAddConversation(
  agentId: string,
  conversationId: string
) {
  return swrMutate(
    conversationsSwrKey(agentId),
    (current: ConversationSummary[] | undefined) => {
      if (current?.some((row) => row.id === conversationId)) {
        return current
      }
      const optimisticRow: ConversationSummary = {
        id: conversationId,
        title: null,
        updatedAt: new Date().toISOString(),
      }
      return [optimisticRow, ...(current ?? [])]
    },
    { revalidate: false }
  )
}

const TITLE_REFRESH_DELAYS_MS = [0, 800, 2500] as const

export async function refreshConversationList(
  agentId: string,
  options?: { conversationId?: string }
) {
  const key = conversationsSwrKey(agentId)
  const conversationId = options?.conversationId

  for (const delayMs of TITLE_REFRESH_DELAYS_MS) {
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
    await revalidateConversations(agentId)
    if (!conversationId) {
      continue
    }
    const rows = await fetchConversations(key)
    const row = rows.find((conversation) => conversation.id === conversationId)
    if (row?.title?.trim()) {
      return
    }
  }
}

export async function fetchConversations(
  url: string
): Promise<ConversationSummary[]> {
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) {
    throw new Error(`Failed to load conversations (${response.status})`)
  }
  const data = (await response.json()) as {
    conversations: ConversationSummary[]
  }
  return data.conversations
}
