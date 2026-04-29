import { notFound, redirect } from 'next/navigation'
import { Suspense } from 'react'
import { getMostRecentConversationForAgent } from '@/lib/agent-chat'
import { requireSession } from '@/lib/auth-guard'
import { getCachedAgentByIdForUser } from '@/lib/data'

type Params = Promise<{ agentId: string }>

/**
 * Chat landing. Redirects to the user's most-recent conversation, or to
 * the draft "new chat" route if no conversations exist yet.
 *
 * The redirect work is wrapped in `<Suspense>` so Cache Components can
 * resume around the uncached session / DB lookups without flagging the
 * whole route as blocking. Only the fallback can reach the client, but
 * since the inner component always throws a redirect that path is never
 * actually rendered to users.
 */
export default function AgentChatIndex({ params }: { params: Params }) {
  return (
    <Suspense fallback={null}>
      <ResolveChatIndex params={params} />
    </Suspense>
  )
}

async function ResolveChatIndex({ params }: { params: Params }) {
  const { agentId } = await params
  const session = await requireSession()
  const agent = await getCachedAgentByIdForUser(agentId, session.user.id)
  if (!agent) {
    notFound()
  }

  const mostRecent = await getMostRecentConversationForAgent(agent.id)
  if (mostRecent) {
    redirect(`/agents/${agent.id}/chat/${mostRecent.id}`)
  }
  redirect(`/agents/${agent.id}/chat/new`)
  // Unreachable: `redirect()` throws. Present only to satisfy the
  // async-component return-type checker, which otherwise sees
  // `Promise<void>` and rejects the component as a JSX element.
  return null
}
