import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { requireSession } from '@/auth/server/auth-guard'
import { AgentChat } from '@/chat/components/agent-chat'
import { newChatConversationId } from '@/chat/lib/new-chat-conversation-id'
import { getCachedAgentByIdForUser } from '@/shared/server/data'
import { createPrivatePageMetadata } from '@/shared/server/site-metadata'

type Params = Promise<{ agentId: string }>
type SearchParams = Promise<{ draft?: string }>

export const metadata = createPrivatePageMetadata(
  'New agent chat',
  'Start a private OUTNA.ME agent conversation.'
)

export default function NewAgentChatPage({
  params,
  searchParams,
}: {
  params: Params
  searchParams: SearchParams
}) {
  return (
    <Suspense fallback={<ChatSkeleton />}>
      <DraftChat params={params} searchParams={searchParams} />
    </Suspense>
  )
}

async function DraftChat({
  params,
  searchParams,
}: {
  params: Params
  searchParams: SearchParams
}) {
  const [{ agentId }, { draft }, session] = await Promise.all([
    params,
    searchParams,
    requireSession(),
  ])
  const agent = await getCachedAgentByIdForUser(agentId, session.user.id)
  if (!agent) {
    notFound()
  }

  const draftConversationId =
    typeof draft === 'string' && draft.startsWith('cc_')
      ? draft
      : newChatConversationId()

  return (
    <AgentChat
      agentId={agent.id}
      conversationId={draftConversationId}
      initialMessages={[]}
      isDraft
      key={draftConversationId}
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
