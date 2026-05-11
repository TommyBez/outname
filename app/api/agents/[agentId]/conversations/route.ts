import 'server-only'
import { NextResponse } from 'next/server'
import { requireSession } from '@/auth/server/auth-guard'
import { listConversationsForAgent } from '@/chat/server/chat'
import { getAgentByIdForUser } from '@/shared/server/data'

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
