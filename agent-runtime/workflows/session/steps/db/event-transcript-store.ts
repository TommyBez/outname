import type { UIMessage } from 'ai'
import { replaceAgentEventTranscriptMessagesBestEffort } from '@/agent-runtime/server/agent-event-transcript-store'

export async function replaceAgentEventTranscriptMessagesBestEffortStep(input: {
  eventId: string
  messages: readonly UIMessage[]
  userId: string
}): Promise<void> {
  'use step'
  await replaceAgentEventTranscriptMessagesBestEffort(input)
}
