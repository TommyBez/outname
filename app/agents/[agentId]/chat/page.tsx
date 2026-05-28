import { notFound, redirect } from 'next/navigation'
import { Suspense } from 'react'
import { requireSession } from '@/auth/server/auth-guard'
import { getMostRecentConversationForAgent } from '@/chat/server/chat'
import { getCachedAgentByIdForUser } from '@/shared/server/data'
import { createPrivatePageMetadata } from '@/shared/server/site-metadata'

type Params = Promise<{ agentId: string }>

export const metadata = createPrivatePageMetadata(
  'Agent chat',
  'Open the most recent private conversation with an OUTNA.ME agent.'
)

export default function AgentChatIndex({ params }: { params: Params }) {
  return (
    <Suspense fallback={null}>
      <ResolveChatIndex params={params} />
    </Suspense>
  )
}

async function ResolveChatIndex({ params }: { params: Params }) {
  const [{ agentId }, session] = await Promise.all([params, requireSession()])
  const agent = await getCachedAgentByIdForUser(agentId, session.user.id)
  if (!agent) {
    notFound()
  }

  const mostRecent = await getMostRecentConversationForAgent(agent.id)
  if (mostRecent) {
    redirect(`/agents/${agent.id}/chat/${mostRecent.id}`)
  }
  redirect(`/agents/${agent.id}/chat/new`)
  return null
}
