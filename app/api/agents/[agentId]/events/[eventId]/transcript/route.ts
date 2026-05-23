import { readUIMessageStream } from 'ai'
import { NextResponse } from 'next/server'
import { getRun } from 'workflow/api'
import { replyNamespaceForEvent } from '@/agent-runtime/server/agent-event-keys'
import type { AgentEventPayloads } from '@/agent-runtime/server/agent-event-store'
import { getAgentEvent } from '@/agent-runtime/server/agent-event-store'
import { summarizeAgentEvent } from '@/agent-runtime/server/agent-event-summaries'
import {
  listAgentEventTranscriptMessages,
  replaceAgentEventTranscriptMessagesBestEffort,
} from '@/agent-runtime/server/agent-event-transcript-store'
import type {
  AgentChatChunk,
  AgentChatMessage,
} from '@/agent-runtime/server/chat-status'
import {
  type AgentEventTranscriptPayload,
  eventSummaryToWorkflowStatus,
  fallbackEventTranscriptMessages,
} from '@/agent-runtime/shared/event-transcript'
import { getSession } from '@/auth/server/auth-guard'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ agentId: string; eventId: string }> }
) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { agentId, eventId } = await params
  const event = await getAgentEvent(eventId)
  if (!event || event.agentId !== agentId || event.userId !== session.user.id) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }

  const summary = summarizeAgentEvent(event)
  const persistedMessages = await listAgentEventTranscriptMessages(event.id)
  const storedMessages =
    persistedMessages.length > 0
      ? persistedMessages
      : await loadFallbackTranscriptMessages(event)
  const body: AgentEventTranscriptPayload = {
    messages:
      storedMessages.length > 0
        ? (storedMessages as AgentEventTranscriptPayload['messages'])
        : fallbackEventTranscriptMessages(summary),
    workflowStatus: eventSummaryToWorkflowStatus(summary),
  }

  return NextResponse.json(body, {
    headers: {
      'Cache-Control': 'no-store',
    },
  })
}

async function loadFallbackTranscriptMessages(
  event: NonNullable<Awaited<ReturnType<typeof getAgentEvent>>>
): Promise<AgentChatMessage[]> {
  if (!(event.workflowRunId && !event.workflowRunId.startsWith('starting:'))) {
    return []
  }

  const run = getRun(event.workflowRunId)
  try {
    await run.status
  } catch (error) {
    if (error instanceof Error && error.name === 'WorkflowRunNotFoundError') {
      return []
    }
    throw error
  }

  const source = run.getReadable<AgentChatChunk>({
    namespace: outputNamespaceForEvent(event),
    startIndex: 0,
  })
  const messages: AgentChatMessage[] = []
  for await (const message of readUIMessageStream<AgentChatMessage>({
    stream: source,
    terminateOnError: false,
  })) {
    upsertMessage(messages, message)
  }
  if (messages.length > 0) {
    await replaceAgentEventTranscriptMessagesBestEffort({
      eventId: event.id,
      messages,
      userId: event.userId,
    })
  }
  return messages
}

function outputNamespaceForEvent(
  event: NonNullable<Awaited<ReturnType<typeof getAgentEvent>>>
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
