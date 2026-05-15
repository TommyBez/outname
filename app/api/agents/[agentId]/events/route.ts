import { type NextRequest, NextResponse } from 'next/server'
import { listAgentEventSummaries } from '@/agent-runtime/server/agent-event-summaries'
import { getSession } from '@/auth/server/auth-guard'
import { getAgentByIdForUser } from '@/shared/server/data'

const DEFAULT_EVENT_LIMIT = 50
const MAX_EVENT_LIMIT = 100

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { agentId } = await params
  const agent = await getAgentByIdForUser(agentId, session.user.id)
  if (!agent) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }

  const limit = readLimit(request)
  const events = await listAgentEventSummaries({ agentId: agent.id, limit })

  return NextResponse.json(
    { events },
    {
      headers: {
        'Cache-Control': 'no-store',
      },
    }
  )
}

function readLimit(request: NextRequest): number {
  const limitParam = request.nextUrl.searchParams.get('limit')
  if (limitParam === null) {
    return DEFAULT_EVENT_LIMIT
  }

  const rawLimit = Number(limitParam)
  if (!Number.isFinite(rawLimit)) {
    return DEFAULT_EVENT_LIMIT
  }
  return Math.max(1, Math.min(MAX_EVENT_LIMIT, Math.floor(rawLimit)))
}
