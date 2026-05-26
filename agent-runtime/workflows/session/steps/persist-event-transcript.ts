import { readAgentEventTranscriptFromWorkflowRun } from '@/agent-runtime/server/agent-event-transcript'
import { replaceAgentEventTranscriptMessagesBestEffort } from '@/agent-runtime/server/agent-event-transcript-store'
import type { AgentChatMessage } from '@/agent-runtime/server/chat-status'
import type { AgentEvent } from '@/shared/db/schema'
import { appendStepLimitNoticeToMessages } from '../step-limit'

export async function persistAgentEventTranscriptStep(input: {
  event: Pick<AgentEvent, 'id' | 'payload' | 'type'>
  stepLimitNotice?: string
  userId: string
  workflowRunId: string
}): Promise<void> {
  'use step'

  let messages: AgentChatMessage[] = []
  try {
    messages = await readAgentEventTranscriptFromWorkflowRun({
      event: input.event,
      workflowRunId: input.workflowRunId,
    })
  } catch (error) {
    console.error('[agent-events] failed to read event transcript', {
      errorCode: 'AGENT_EVENT_TRANSCRIPT_READ_FAILED',
      errorMessage:
        error instanceof Error ? error.message : 'unknown transcript error',
      eventId: input.event.id,
      workflowRunId: input.workflowRunId,
    })
  }
  const persistedMessages = input.stepLimitNotice
    ? appendStepLimitNoticeToMessages(messages, input.stepLimitNotice)
    : messages

  await replaceAgentEventTranscriptMessagesBestEffort({
    eventId: input.event.id,
    messages: persistedMessages,
    userId: input.userId,
  })
}
