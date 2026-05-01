import { getRun } from 'workflow/api'
import type { AgentChatChunk } from '@/lib/agent-chat-status'
import { getSession } from '@/lib/auth-guard'
import { getAgentByIdForUser } from '@/lib/data'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const session = await getSession()
  if (!session) {
    return jsonError(401, 'unauthorized')
  }

  const { agentId } = await params
  const agent = await getAgentByIdForUser(agentId, session.user.id)
  if (!agent) {
    return jsonError(404, 'not found')
  }
  if (!agent.lastSessionRunId) {
    return jsonError(409, 'no session stream yet')
  }

  const run = getRun(agent.lastSessionRunId)
  try {
    await run.status
  } catch (err) {
    if (!(err instanceof Error && err.name === 'WorkflowRunNotFoundError')) {
      throw err
    }
    return jsonError(409, 'workflow unavailable in this environment', {
      workflowRunId: agent.lastSessionRunId,
    })
  }

  const source = run.getReadable<AgentChatChunk>({
    namespace: agent.lastSessionRunId,
    startIndex: 0,
  })

  const encoder = new TextEncoder()
  const body = source.pipeThrough(
    new TransformStream<AgentChatChunk, Uint8Array>({
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

function jsonError(status: number, error: string, extra?: object): Response {
  return new Response(JSON.stringify({ error, ...extra }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
