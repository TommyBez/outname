import type { UIMessage } from 'ai'
import { revalidateTag } from 'next/cache'
import { persistNewChatMessages } from '@/lib/agent-chat'
import { conversationListTag } from '@/lib/cache-tags'

/**
 * Post-stream persistence step.
 *
 * The chat workflow streams UIMessageChunks live to the client via
 * `getWritable`, then hands the accumulated UIMessages to this step so
 * the assistant turn (and any new user message parts the agent chose to
 * include) land in Postgres.
 *
 * Kept as its own `"use step"` so the DB write participates in the
 * workflow's durability / retry semantics — failures to persist are
 * independently retried and do not silently corrupt the transcript.
 */
export async function persistAssistantTurn(input: {
  agentId: string
  conversationId: string
  uiMessages: UIMessage[]
}): Promise<void> {
  'use step'
  await persistNewChatMessages(input)
  revalidateTag(conversationListTag(input.agentId), 'max')
}
