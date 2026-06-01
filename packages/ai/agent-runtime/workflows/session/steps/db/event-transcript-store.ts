import { replaceAgentEventTranscriptMessagesBestEffort } from '@outname/ai/agent-runtime/server/agent-event-transcript-store'
import type { UIMessage } from 'ai'

export async function replaceAgentEventTranscriptMessagesBestEffortStep(input: {
  eventId: string
  messages: readonly UIMessage[]
  userId: string
}): Promise<void> {
  'use step'
  await replaceAgentEventTranscriptMessagesBestEffort(input)
}
