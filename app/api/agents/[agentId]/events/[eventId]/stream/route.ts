import { getRun } from 'workflow/api'
import {
  eventActivityNamespace,
  replyNamespaceForEvent,
} from '@/agent-runtime/server/agent-event-keys'
import { getAgentEvent } from '@/agent-runtime/server/agent-event-store'
import type { AgentChatChunk } from '@/agent-runtime/server/chat-status'
import type { RunEvent } from '@/agent-runtime/server/run-events'
import { getSession } from '@/auth/server/auth-guard'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ agentId: string; eventId: string }> }
) {
  const session = await getSession()
  if (!session) {
    return jsonError(401, 'unauthorized')
  }

  const { agentId, eventId } = await params
  const event = await getAgentEvent(eventId)
  if (!event || event.agentId !== agentId || event.userId !== session.user.id) {
    return jsonError(404, 'not found')
  }
  if (!event.workflowRunId || event.workflowRunId.startsWith('starting:')) {
    return jsonError(409, 'event has not started yet')
  }

  const streamKind = readStreamKind(request)
  const namespace =
    streamKind === 'activity'
      ? eventActivityNamespace(event.workflowRunId)
      : replyNamespaceForEvent(event.id)
  const source = getRun(event.workflowRunId).getReadable<
    AgentChatChunk | RunEvent
  >({
    namespace,
    startIndex: 0,
  })

  const encoder = new TextEncoder()
  const body = source.pipeThrough(
    new TransformStream<AgentChatChunk | RunEvent, Uint8Array>({
      transform(chunk, controller) {
        controller.enqueue(encoder.encode(`${JSON.stringify(chunk)}\n`))
      },
    })
  )

  return new Response(body, {
    headers: {
      'Cache-Control': 'no-store, no-transform',
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'X-Accel-Buffering': 'no',
    },
  })
}

function readStreamKind(request: Request): 'activity' | 'output' {
  const searchParams = new URL(request.url).searchParams
  const stream = searchParams.get('stream')
  if (stream === 'activity' || searchParams.get('namespace') === 'activity') {
    return 'activity'
  }
  return 'output'
}

function jsonError(status: number, error: string): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
