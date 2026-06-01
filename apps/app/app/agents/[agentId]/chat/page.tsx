import { getMostRecentConversationForAgent } from '@outname/ai/chat/server/chat'
import { requireSession } from '@outname/auth/server/auth-guard'
import { getCachedAgentByIdForUser } from '@outname/shared/server/data'
import { createPrivatePageMetadata } from '@outname/shared/server/site-metadata'
import { notFound, redirect } from 'next/navigation'
import { Suspense } from 'react'

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
