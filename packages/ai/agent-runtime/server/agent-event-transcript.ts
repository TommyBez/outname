import 'server-only'
import { replyNamespaceForEvent } from '@outname/ai/agent-runtime/server/agent-event-keys'
import type { AgentEventPayloads } from '@outname/ai/agent-runtime/server/agent-event-store'
import { summarizeAgentEvent } from '@outname/ai/agent-runtime/server/agent-event-summaries'
import { listAgentEventTranscriptMessages } from '@outname/ai/agent-runtime/server/agent-event-transcript-store'
import type {
  AgentChatChunk,
  AgentChatMessage,
  WorkflowStatusData,
} from '@outname/ai/agent-runtime/server/chat-status'
import {
  eventSummaryToWorkflowStatus,
  fallbackEventTranscriptMessages,
} from '@outname/ai/agent-runtime/shared/event-transcript'
import { upsertMessage } from '@outname/ai/agent-runtime/shared/message-utils'
import type { AgentEvent } from '@outname/db/schema'
import { getRun } from '@outname/workflow/api'
import { readUIMessageStream } from 'ai'
import { readableAgentEventWorkflowRunId } from './agent-event-workflow-run-id'

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
  if (
    event.type === 'invocation' &&
    isInvocationPayload(event.payload) &&
    event.payload.streamToken.length > 0
  ) {
    return event.payload.streamToken
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
    requiresPersistedTranscript(
      readableAgentEventWorkflowRunId(event.workflowRunId),
      event.status
    )
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
  let messages: AgentChatMessage[] = []

  for await (const message of readUIMessageStream<AgentChatMessage>({
    stream: source,
    terminateOnError: false,
  })) {
    messages = upsertMessage(messages, message)
  }

  return messages
}

function requiresPersistedTranscript(
  workflowRunId: string | null,
  status: AgentEvent['status']
): boolean {
  return (
    typeof workflowRunId === 'string' &&
    (status === 'completed' || status === 'failed' || status === 'cancelled')
  )
}
function isInvocationPayload(
  payload: unknown
): payload is AgentEventPayloads['invocation'] {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    typeof Reflect.get(payload, 'streamToken') === 'string'
  )
}
