import type { AgentChatMessage } from '@/agent-runtime/server/chat-status'

export function hasAssistantContentAfterLatestUser(
  messages: AgentChatMessage[]
) {
  const latestUserIndex = messages.findLastIndex(
    (message) => message.role === 'user'
  )
  if (latestUserIndex < 0) {
    return false
  }

  return messages.slice(latestUserIndex + 1).some(hasVisibleAssistantContent)
}

function hasVisibleAssistantContent(message: AgentChatMessage) {
  if (message.role !== 'assistant') {
    return false
  }

  return message.parts.some((part) => {
    if (part.type === 'text' || part.type === 'reasoning') {
      return part.text.trim().length > 0
    }

    return (
      part.type === 'dynamic-tool' ||
      part.type === 'source-url' ||
      part.type === 'source-document' ||
      part.type === 'file' ||
      part.type === 'step-start' ||
      (typeof part.type === 'string' && part.type.startsWith('tool-'))
    )
  })
}
