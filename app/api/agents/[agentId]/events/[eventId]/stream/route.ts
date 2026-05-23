import { getRun } from 'workflow/api'
import {
  eventActivityNamespace,
  replyNamespaceForEvent,
} from '@/agent-runtime/server/agent-event-keys'
import { reconcileActiveAgentEvent } from '@/agent-runtime/server/agent-event-reconciliation'
import type { AgentEventPayloads } from '@/agent-runtime/server/agent-event-store'
import { getAgentEvent } from '@/agent-runtime/server/agent-event-store'
import type { AgentChatChunk } from '@/agent-runtime/server/chat-status'
import type { RunEvent } from '@/agent-runtime/server/run-events'
import { WORKFLOW_STREAM_UNAVAILABLE_MESSAGE } from '@/agent-runtime/shared/workflow-stream-messages'
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

  const run = getRun(event.workflowRunId)
  try {
    await run.status
  } catch (err) {
    if (!(err instanceof Error && err.name === 'WorkflowRunNotFoundError')) {
      throw err
    }
    if (event.status === 'starting' || event.status === 'running') {
      await reconcileActiveAgentEvent(event)
    }
    // 503 (not 409) so clients do not treat a missing run as "still starting".
    return jsonError(503, WORKFLOW_STREAM_UNAVAILABLE_MESSAGE)
  }

  const streamKind = readStreamKind(request)
  const startIndex = readStartIndex(request)
  const namespace =
    streamKind === 'activity'
      ? eventActivityNamespace(event.workflowRunId)
      : outputNamespaceForEvent(event)
  const source = run.getReadable<AgentChatChunk | RunEvent>({
    namespace,
    startIndex,
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

function readStartIndex(request: Request): number {
  const searchParams = new URL(request.url).searchParams
  const rawStartIndex = Number(searchParams.get('startIndex') ?? '0')
  if (!Number.isFinite(rawStartIndex)) {
    return 0
  }
  return Math.max(0, Math.floor(rawStartIndex))
}

function readStreamKind(request: Request): 'activity' | 'output' {
  const searchParams = new URL(request.url).searchParams
  const stream = searchParams.get('stream')
  if (stream === 'activity' || searchParams.get('namespace') === 'activity') {
    return 'activity'
  }
  return 'output'
}

function outputNamespaceForEvent(
  event: NonNullable<Awaited<ReturnType<typeof getAgentEvent>>>
): string {
  if (event?.type === 'invocation') {
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

function jsonError(status: number, error: string): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
