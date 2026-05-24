import { NextResponse } from 'next/server'
import { getAgentEvent } from '@/agent-runtime/server/agent-event-store'
import {
  loadPersistedAgentEventTranscript,
  MissingPersistedEventTranscriptError,
} from '@/agent-runtime/server/agent-event-transcript'
import type { AgentEventTranscriptPayload } from '@/agent-runtime/shared/event-transcript'
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

  let body: AgentEventTranscriptPayload
  try {
    body = await loadPersistedAgentEventTranscript(event)
  } catch (error) {
    if (error instanceof MissingPersistedEventTranscriptError) {
      return NextResponse.json(
        { error: 'persisted transcript missing for completed event' },
        { status: 409 }
      )
    }
    throw error
  }

  return NextResponse.json(body, {
    headers: {
      'Cache-Control': 'no-store',
    },
  })
}
