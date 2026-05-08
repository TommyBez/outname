import { readUIMessageStream } from 'ai'
import { getRun } from 'workflow/api'
import type {
  AgentChatChunk,
  AgentChatMessage,
} from '@/agent-runtime/server/chat-status'

export async function collectSubAgentMessages(input: {
  sessionRunId: string
  streamToken: string
}): Promise<{ error: string | null; messages: AgentChatMessage[] }> {
  'use step'
  const messages: AgentChatMessage[] = []
  let streamError: string | null = null
  const readable = getRun(input.sessionRunId).getReadable<AgentChatChunk>({
    namespace: input.streamToken,
    startIndex: 0,
  })

  for await (const message of readUIMessageStream<AgentChatMessage>({
    onError(error) {
      streamError = error instanceof Error ? error.message : String(error)
    },
    stream: readable,
    terminateOnError: false,
  })) {
    upsertMessage(messages, message)
  }

  return { error: streamError, messages }
}

function upsertMessage(
  messages: AgentChatMessage[],
  message: AgentChatMessage
): void {
  const index = messages.findIndex((item) => item.id === message.id)
  if (index < 0) {
    messages.push(message)
    return
  }
  messages[index] = message
}
