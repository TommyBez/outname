import 'server-only'
import { replyNamespaceForEvent } from '@/agent-runtime/server/agent-event-keys'
import type { AgentEventPayloads } from '@/agent-runtime/server/agent-event-store'
import { summarizeAgentEvent } from '@/agent-runtime/server/agent-event-summaries'
import { listAgentEventTranscriptMessages } from '@/agent-runtime/server/agent-event-transcript-store'
import type {
  AgentChatMessage,
  WorkflowStatusData,
} from '@/agent-runtime/server/chat-status'
import {
  eventSummaryToWorkflowStatus,
  fallbackEventTranscriptMessages,
} from '@/agent-runtime/shared/event-transcript'
import type { AgentEvent } from '@/shared/db/schema'

export interface AgentEventTranscriptData {
  messages: AgentChatMessage[]
  workflowStatus: WorkflowStatusData
}

export function outputNamespaceForAgentEvent(
  event: Pick<AgentEvent, 'id' | 'payload' | 'type'>
): string {
  if (event.type === 'invocation') {
    const payload = event.payload as AgentEventPayloads['invocation']
    if (
      typeof payload?.streamToken === 'string' &&
      payload.streamToken.length > 0
    ) {
      return payload.streamToken
    }
  }
  return replyNamespaceForEvent(event.id)
}

export async function loadPersistedAgentEventTranscript(
  event: AgentEvent
): Promise<AgentEventTranscriptData> {
  const summary = summarizeAgentEvent(event)
  const persistedMessages = await listAgentEventTranscriptMessages(event.id)

  return {
    messages:
      persistedMessages.length > 0
        ? persistedMessages
        : fallbackEventTranscriptMessages(summary),
    workflowStatus: eventSummaryToWorkflowStatus(summary),
  }
}
