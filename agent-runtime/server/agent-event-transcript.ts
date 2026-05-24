import 'server-only'
import { readUIMessageStream } from 'ai'
import { getRun } from 'workflow/api'
import { replyNamespaceForEvent } from '@/agent-runtime/server/agent-event-keys'
import type { AgentEventPayloads } from '@/agent-runtime/server/agent-event-store'
import { summarizeAgentEvent } from '@/agent-runtime/server/agent-event-summaries'
import { listAgentEventTranscriptMessages } from '@/agent-runtime/server/agent-event-transcript-store'
import type {
  AgentChatChunk,
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

export class MissingPersistedEventTranscriptError extends Error {
  constructor(eventId: string) {
    super(`Persisted transcript missing for event ${eventId}`)
    this.name = 'MissingPersistedEventTranscriptError'
  }
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
  if (
    persistedMessages.length === 0 &&
    requiresPersistedTranscript(event.workflowRunId, event.status)
  ) {
    throw new MissingPersistedEventTranscriptError(event.id)
  }

  return {
    messages:
      persistedMessages.length > 0
        ? persistedMessages
        : fallbackEventTranscriptMessages(summary),
    workflowStatus: eventSummaryToWorkflowStatus(summary),
  }
}

export async function readAgentEventTranscriptFromWorkflowRun(input: {
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

function requiresPersistedTranscript(
  workflowRunId: string | null,
  status: AgentEvent['status']
): boolean {
  return (
    typeof workflowRunId === 'string' &&
    !workflowRunId.startsWith('starting:') &&
    (status === 'completed' || status === 'failed' || status === 'cancelled')
  )
}
