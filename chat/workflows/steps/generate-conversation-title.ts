import type { UIMessage } from 'ai'
import { generateText } from 'ai'
import { eq } from 'drizzle-orm'
import { revalidateTag } from 'next/cache'
import {
  getConversationForAgent,
  setConversationTitleIfUnset,
} from '@/chat/server/chat'
import { db } from '@/shared/db'
import { agent } from '@/shared/db/schema'
import { getUserModelForGateway } from '@/shared/server/ai-gateway-byok'
import { conversationListTag } from '@/shared/server/cache-tags'

function extractText(message: UIMessage | undefined): string {
  if (!message) {
    return ''
  }
  const parts = message.parts ?? []
  const chunks: string[] = []
  for (const part of parts) {
    if (part.type === 'text' && typeof part.text === 'string') {
      chunks.push(part.text)
    }
  }
  return chunks.join('\n').trim()
}

export async function maybeGenerateConversationTitle(input: {
  agentId: string
  conversationId: string
  uiMessages: UIMessage[]
}): Promise<void> {
  'use step'

  const conversation = await getConversationForAgent(
    input.conversationId,
    input.agentId
  )
  if (!conversation) {
    return
  }
  if (conversation.title) {
    return
  }

  const firstUserMessage = input.uiMessages.find((m) => m.role === 'user')
  const firstUserText = extractText(firstUserMessage)
  if (!firstUserText) {
    return
  }

  const fallback = firstUserText.slice(0, 60).trim() || 'New chat'
  const [agentRow] = await db
    .select({ userId: agent.userId })
    .from(agent)
    .where(eq(agent.id, input.agentId))
    .limit(1)
  if (!agentRow) {
    return
  }

  try {
    const { text } = await generateText({
      model: await getUserModelForGateway({
        modelId: 'openai/gpt-5.4-nano',
        userId: agentRow.userId,
      }),
      system: [
        'You name chat conversations.',
        'Return a concise 3-6 word title summarising what the user is asking.',
        'Use title case. No quotes. No trailing punctuation.',
        "If the message is greeting-only, respond with 'New Chat'.",
      ].join('\n'),
      prompt: firstUserText.slice(0, 2000),
    })

    const cleaned = text
      .replace(/^["'`]+|["'`]+$/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80)

    await setConversationTitleIfUnset(input.conversationId, cleaned || fallback)
  } catch {
    await setConversationTitleIfUnset(input.conversationId, fallback)
  }

  revalidateTag(conversationListTag(input.agentId), 'max')
}
