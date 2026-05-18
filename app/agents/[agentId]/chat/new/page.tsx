import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { requireSession } from '@/auth/server/auth-guard'
import { AgentChat } from '@/chat/components/agent-chat'
import { isDraftConversationId } from '@/chat/lib/draft-conversation-id'
import { newChatConversationId } from '@/chat/server/chat'
import { getCachedAgentByIdForUser } from '@/shared/server/data'

type Params = Promise<{ agentId: string }>
type SearchParams = Promise<{ draft?: string }>

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
  const { agentId } = await params
  const { draft } = await searchParams
  const session = await requireSession()
  const agent = await getCachedAgentByIdForUser(agentId, session.user.id)
  if (!agent) {
    notFound()
  }

  // Draft ids stay DB-free until the first send persists the conversation.
  // The client then `replaceState()`s to `/chat/[conversationId]` without remounting `useChat`.
  const draftConversationId = isDraftConversationId(draft)
    ? draft
    : newChatConversationId()
  const remountKey = draft ?? draftConversationId

  return (
    <AgentChat
      agentId={agent.id}
      conversationId={draftConversationId}
      initialMessages={[]}
      isDraft
      key={remountKey}
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
