import type { UIMessage } from 'ai'

export function createAssistantTextMessage(input: {
  id: string
  text: string
}): UIMessage {
  return {
    id: input.id,
    parts: [{ text: input.text, type: 'text' }],
    role: 'assistant',
  }
}

export function upsertMessage<TMessage extends { id: string }>(
  messages: readonly TMessage[],
  message: TMessage
): TMessage[] {
  const index = messages.findIndex((item) => item.id === message.id)
  if (index < 0) {
    return [...messages, message]
  }
  const next = messages.slice()
  next[index] = message
  return next
}
