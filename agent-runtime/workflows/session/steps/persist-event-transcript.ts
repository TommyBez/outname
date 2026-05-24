import { readAgentEventTranscriptFromWorkflowRun } from '@/agent-runtime/server/agent-event-transcript'
import { replaceAgentEventTranscriptMessagesBestEffort } from '@/agent-runtime/server/agent-event-transcript-store'
import type { AgentEvent } from '@/shared/db/schema'
import { appendStepLimitNoticeToMessages } from '../step-limit'

export async function persistAgentEventTranscriptStep(input: {
  event: Pick<AgentEvent, 'id' | 'payload' | 'type'>
  stepLimitNotice?: string
  userId: string
  workflowRunId: string
}): Promise<void> {
  'use step'

  const messages = await readAgentEventTranscriptFromWorkflowRun({
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
