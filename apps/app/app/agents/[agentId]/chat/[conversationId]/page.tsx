import { AgentChat } from '@outname/ai/chat/components/agent-chat'
import { requireSession } from '@outname/auth/server/auth-guard'
import { createPrivatePageMetadata } from '@outname/shared/server/site-metadata'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { loadConversationPageData } from './conversation-page-data'

type Params = Promise<{ agentId: string; conversationId: string }>

export const metadata = createPrivatePageMetadata(
  'Agent conversation',
  'Continue a private OUTNA.ME agent conversation.'
)

export default function AgentConversationPage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<ChatSkeleton />}>
      <ConversationShell params={params} />
    </Suspense>
  )
}

async function ConversationShell({ params }: { params: Params }) {
  const [{ agentId, conversationId }, session] = await Promise.all([
    params,
    requireSession(),
  ])
  const conversationPageData = await loadConversationPageData({
    agentId,
    conversationId,
    userId: session.user.id,
  })
  if (!conversationPageData) {
    notFound()
  }

  return (
    <AgentChat
      agentId={conversationPageData.agentId}
      conversationId={conversationPageData.conversationId}
      initialMessages={conversationPageData.initialMessages}
    />
  )
}

function ChatSkeleton() {
  return (
    <div className="flex h-full min-w-0 flex-col gap-3">
      <div className="h-64 w-full flex-1 animate-pulse rounded-sm bg-muted" />
      <div className="h-12 w-full animate-pulse rounded-sm bg-muted" />
    </div>
  )
}
