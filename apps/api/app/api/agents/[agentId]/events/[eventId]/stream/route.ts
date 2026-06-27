import { createModelCallToUIChunkTransform } from '@ai-sdk/workflow'
import { reconcileActiveAgentEvent } from '@outname/ai/agent-runtime/server/agent-event-reconciliation'
import { getAgentEvent } from '@outname/ai/agent-runtime/server/agent-event-store'
import { outputNamespaceForAgentEvent } from '@outname/ai/agent-runtime/server/agent-event-transcript'
import { readableAgentEventWorkflowRunId } from '@outname/ai/agent-runtime/server/agent-event-workflow-run-id'
import type {
  AgentChatChunk,
  AgentModelCallChunk,
} from '@outname/ai/agent-runtime/server/chat-status'
import {
  type RunEvent,
  runEventsNamespace,
} from '@outname/ai/agent-runtime/server/run-events'
import { WORKFLOW_STREAM_UNAVAILABLE_MESSAGE } from '@outname/ai/agent-runtime/shared/workflow-stream-messages'
import { getSession } from '@outname/auth/server/auth-guard'
import { getRun } from '@outname/workflow/api'

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
  const workflowRunId = readableAgentEventWorkflowRunId(event.workflowRunId)
  if (!workflowRunId) {
    return jsonError(409, 'event has not started yet')
  }

  const run = getRun(workflowRunId)
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
  const source =
    streamKind === 'activity'
      ? run.getReadable<RunEvent>({
          namespace: runEventsNamespace(workflowRunId),
          startIndex,
        })
      : run
          .getReadable<AgentModelCallChunk>({
            namespace: outputNamespaceForAgentEvent(event),
            startIndex,
          })
          .pipeThrough(createModelCallToUIChunkTransform())

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

function jsonError(status: number, error: string): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
