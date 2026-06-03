import {
  getConversationForAgent,
  setConversationTitleIfUnset,
} from '@outname/ai/chat/server/chat'
import { db } from '@outname/db'
import { agent } from '@outname/db/schema'
import { conversationListTag } from '@outname/shared/server/cache-tags'
import {
  getRequiredDefaultInferenceProvider,
  getUserLanguageModel,
} from '@outname/shared/server/inference-providers'
import type { UIMessage } from 'ai'
import { generateText } from 'ai'
import { eq } from 'drizzle-orm'
import { revalidateTag } from 'next/cache'

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

const LEADING_GREETING_PATTERN =
  /^(?:ciao|salve|buongiorno|buonasera|hello|hi|hey|yo)(?:[!,.:;?—-]+|\s+)+/i
const ONLY_GREETING_PATTERN =
  /^(?:ciao|salve|buongiorno|buonasera|hello|hi|hey|yo)[!,.:;?—\s-]*$/i

function isPlaceholderTitle(title: string): boolean {
  return title.trim().replace(/\s+/g, ' ').toLowerCase() === 'new chat'
}

function stripLeadingGreeting(text: string): string {
  const trimmed = text.trim()
  if (ONLY_GREETING_PATTERN.test(trimmed)) {
    return ''
  }
  return trimmed.replace(LEADING_GREETING_PATTERN, '').trim()
}

function selectTitleSeed(messages: UIMessage[]): string {
  for (const message of messages) {
    if (message.role !== 'user') {
      continue
    }
    const text = stripLeadingGreeting(extractText(message))
    if (text) {
      return text
    }
  }
  return ''
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
  if (conversation.title && !isPlaceholderTitle(conversation.title)) {
    return
  }

  const titleSeed = selectTitleSeed(input.uiMessages)
  if (!titleSeed) {
    return
  }

  const fallback = titleSeed.slice(0, 60).trim()
  const [agentRow] = await db
    .select({ userId: agent.userId })
    .from(agent)
    .where(eq(agent.id, input.agentId))
    .limit(1)
  if (!agentRow) {
    return
  }

  let didSetTitle = false
  try {
    const { text } = await generateText({
      model: await getTitleModel(agentRow.userId),
      system: [
        'You name chat conversations.',
        'Return a concise 3-6 word title summarising what the user is asking.',
        'Use title case. No quotes. No trailing punctuation.',
        "If the message is greeting-only, respond with 'New Chat'.",
      ].join('\n'),
      prompt: titleSeed.slice(0, 2000),
    })

    const cleaned = text
      .replace(/^["'`]+|["'`]+$/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80)

    if (cleaned && !isPlaceholderTitle(cleaned)) {
      await setConversationTitleIfUnset(input.conversationId, cleaned)
      didSetTitle = true
    }
  } catch {
    // Keep title generation best-effort; fallback below preserves a useful label.
  }

  if (!didSetTitle) {
    await setConversationTitleIfUnset(input.conversationId, fallback)
  }
  revalidateTag(conversationListTag(input.agentId), 'max')
}

async function getTitleModel(userId: string) {
  const inferenceProvider = await getRequiredDefaultInferenceProvider(userId)
  return await getUserLanguageModel({
    inferenceProvider,
    modelId: 'openai/gpt-5.4-nano',
    userId,
  })
}
