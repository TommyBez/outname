import { notFound, redirect } from "next/navigation"
import { requireSession } from "@/lib/auth-guard"
import { getAgentByIdForUser } from "@/lib/data"
import { getMostRecentConversationForAgent } from "@/lib/agent-chat"

type Params = Promise<{ agentId: string }>

/**
 * Chat landing. Redirects to the user's most-recent conversation, or to
 * the draft "new chat" route if no conversations exist yet. This page
 * never renders — it exists solely so `/agents/[id]/chat` always
 * resolves to something sensible.
 */
export default async function AgentChatIndex({ params }: { params: Params }) {
  const { agentId } = await params
  const session = await requireSession()
  const agent = await getAgentByIdForUser(agentId, session.user.id)
  if (!agent) notFound()

  const mostRecent = await getMostRecentConversationForAgent(agent.id)
  if (mostRecent) {
    redirect(`/agents/${agent.id}/chat/${mostRecent.id}`)
  }
  redirect(`/agents/${agent.id}/chat/new`)
}
