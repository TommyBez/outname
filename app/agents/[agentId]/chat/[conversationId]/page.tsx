import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { requireSession } from '@/auth/server/auth-guard'
import { AgentChat } from '@/chat/components/agent-chat'
import { getConversationForAgent, loadChatHistory } from '@/chat/server/chat'
import { getCachedAgentByIdForUser } from '@/shared/server/data'
import { createPrivatePageMetadata } from '@/shared/server/site-metadata'

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
  const agent = await getCachedAgentByIdForUser(agentId, session.user.id)
  if (!agent) {
    notFound()
  }

  // Re-check conversation ownership here so guessed URLs 404 instead of leaking transcripts.
  const conversation = await getConversationForAgent(conversationId, agent.id)
  if (!conversation) {
    notFound()
  }

  const initialMessages = await loadChatHistory(conversation.id)

  return (
    <AgentChat
      agentId={agent.id}
      conversationId={conversation.id}
      initialMessages={initialMessages}
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
