import { NextResponse } from 'next/server'
import { getAgentEvent } from '@/agent-runtime/server/agent-event-store'
import { summarizeAgentEvent } from '@/agent-runtime/server/agent-event-summaries'
import { listAgentEventTranscriptMessages } from '@/agent-runtime/server/agent-event-transcript-store'
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
  const storedMessages = await listAgentEventTranscriptMessages(event.id)
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
