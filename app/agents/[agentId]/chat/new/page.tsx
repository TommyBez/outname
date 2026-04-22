import { Suspense } from "react"
import { notFound } from "next/navigation"
import { requireSession } from "@/lib/auth-guard"
import { getCachedAgentByIdForUser } from "@/lib/data"
import { newChatConversationId } from "@/lib/agent-chat"
import { getAgentRuntime } from "@/lib/agent-runtime-registry"
import { AgentChat } from "@/components/agent-chat"
import type { AgentKind } from "@/lib/db/schema"

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
  if (!agent) notFound()

  const runtime = getAgentRuntime(agent.kind as AgentKind)
  if (!runtime?.buildAgent) notFound()

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
