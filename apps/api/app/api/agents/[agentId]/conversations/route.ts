import 'server-only'
import { listConversationsForAgent } from '@outname/ai/chat/server/chat'
import { requireSession } from '@outname/auth/server/auth-guard'
import { getAgentByIdForUser } from '@outname/shared/server/data'
import { NextResponse } from 'next/server'

// The sidebar polls this directly so chat list refreshes do not remount the active `useChat` tree.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const { agentId } = await params
  const session = await requireSession()
  const agent = await getAgentByIdForUser(agentId, session.user.id)
  if (!agent) {
    return NextResponse.json({ error: 'agent not found' }, { status: 404 })
  }

  const rows = await listConversationsForAgent(agent.id)
  return NextResponse.json({
    conversations: rows.map((r) => ({
      id: r.id,
      title: r.title,
      updatedAt: r.updatedAt.toISOString(),
    })),
  })
}
