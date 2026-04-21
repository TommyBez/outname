import "server-only"
import { NextResponse } from "next/server"
import { requireSession } from "@/lib/auth-guard"
import { getAgentByIdForUser } from "@/lib/data"
import { listConversationsForAgent } from "@/lib/agent-chat"

/**
 * Client-facing conversation list endpoint. Feeds the sidebar's SWR
 * hook so it can update independently of the active chat pane — no
 * more `router.refresh()` bulldozing the RSC tree (and the active
 * `useChat` state) after every turn.
 *
 * Owner-scoped via `requireSession()` + `getAgentByIdForUser`, so the
 * shape is exactly what the sidebar renders with no extra filtering
 * on the client.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ agentId: string }> },
) {
  const { agentId } = await params
  const session = await requireSession()
  const agent = await getAgentByIdForUser(agentId, session.user.id)
  if (!agent) {
    return NextResponse.json({ error: "agent not found" }, { status: 404 })
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
