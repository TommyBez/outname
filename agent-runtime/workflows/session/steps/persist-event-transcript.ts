import { readUIMessageStream } from 'ai'
import { getRun } from 'workflow/api'
import { outputNamespaceForAgentEvent } from '@/agent-runtime/server/agent-event-transcript'
import { replaceAgentEventTranscriptMessagesBestEffort } from '@/agent-runtime/server/agent-event-transcript-store'
import type {
  AgentChatChunk,
  AgentChatMessage,
} from '@/agent-runtime/server/chat-status'
import type { AgentEvent } from '@/shared/db/schema'
import { appendStepLimitNoticeToMessages } from '../step-limit'

export async function persistAgentEventTranscriptStep(input: {
  event: Pick<AgentEvent, 'id' | 'payload' | 'type'>
  stepLimitNotice?: string
  userId: string
  workflowRunId: string
}): Promise<void> {
  'use step'

  const messages = await collectAgentEventTranscriptMessages({
    event: input.event,
    workflowRunId: input.workflowRunId,
  })
  const persistedMessages = input.stepLimitNotice
    ? appendStepLimitNoticeToMessages(messages, input.stepLimitNotice)
    : messages

  await replaceAgentEventTranscriptMessagesBestEffort({
    eventId: input.event.id,
    messages: persistedMessages,
    userId: input.userId,
  })
}

async function collectAgentEventTranscriptMessages(input: {
  event: Pick<AgentEvent, 'id' | 'payload' | 'type'>
  workflowRunId: string
}): Promise<AgentChatMessage[]> {
  const run = getRun(input.workflowRunId)
  const source = run.getReadable<AgentChatChunk>({
    namespace: outputNamespaceForAgentEvent(input.event),
    startIndex: 0,
  })
  const messages: AgentChatMessage[] = []

  for await (const message of readUIMessageStream<AgentChatMessage>({
    stream: source,
    terminateOnError: false,
  })) {
    const index = messages.findIndex((item) => item.id === message.id)
    if (index < 0) {
      messages.push(message)
      continue
    }
    messages[index] = message
  }

  return messages
}
