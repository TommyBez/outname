import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { requireSession } from '@/auth/server/auth-guard'
import { AgentChat } from '@/chat/components/agent-chat'
import { newChatConversationId } from '@/chat/server/chat'
import { getCachedAgentByIdForUser } from '@/shared/server/data'

type Params = Promise<{ agentId: string }>

/**
 * Draft chat surface. Generates a candidate conversation id server-side
 * and hands it to the chat component, but does NOT persist anything.
 *
 * The conversation row is created lazily inside the API route when the
 * first user message arrives (`getOrCreateConversationForAgent`), so a
 * user who clicks "New chat" and navigates away leaves zero rows behind.
 *
 * On first send the client component swaps the URL to the persisted
 * `/chat/[conversationId]` path via `window.history.replaceState`, which
 * keeps the streaming `useChat` instance mounted while matching the
 * canonical route shape.
 */
export default function NewAgentChatPage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<ChatSkeleton />}>
      <DraftChat params={params} />
    </Suspense>
  )
}

async function DraftChat({ params }: { params: Params }) {
  const { agentId } = await params
  const session = await requireSession()
  const agent = await getCachedAgentByIdForUser(agentId, session.user.id)
  if (!agent) {
    notFound()
  }

  const draftConversationId = newChatConversationId()

  return (
    <AgentChat
      agentId={agent.id}
      conversationId={draftConversationId}
      initialMessages={[]}
      isDraft
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
