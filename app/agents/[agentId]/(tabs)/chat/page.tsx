import { Suspense } from "react"
import { notFound } from "next/navigation"
import { requireSession } from "@/lib/auth-guard"
import { getAgentByIdForUser } from "@/lib/data"
import {
  ensureConversationForAgent,
  loadChatHistory,
} from "@/lib/agent-chat"
import { getAgentRuntime } from "@/lib/agent-runtime-registry"
import { AgentChat } from "@/components/agent-chat"
import type { AgentKind } from "@/lib/db/schema"

type Params = Promise<{ agentId: string }>

/**
 * Chat surface for an agent. Uncached data reads (session, conversation,
 * history) live inside the inner async component so Cache Components can
 * stream the shell while data loads — the outer component stays pure.
 */
export default function AgentChatPage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<ChatSkeleton />}>
      <AgentChatShell params={params} />
    </Suspense>
  )
}

async function AgentChatShell({ params }: { params: Params }) {
  const { agentId } = await params
  const session = await requireSession()
  const agent = await getAgentByIdForUser(agentId, session.user.id)
  if (!agent) notFound()

  const runtime = getAgentRuntime(agent.kind as AgentKind)
  if (!runtime?.buildAgent) notFound()

  // Creating the conversation eagerly on first visit (rather than on first
  // user message) lets us render a stable, empty history view and keeps the
  // API route's job purely "append messages" without race-y first-insert.
  const conversationId = await ensureConversationForAgent(agent.id)
  const initialMessages = await loadChatHistory(conversationId)

  return (
    <div className="flex flex-col">
      <AgentChat agentId={agent.id} initialMessages={initialMessages} />
    </div>
  )
}

function ChatSkeleton() {
  return (
    <div className="flex flex-col gap-3 border-t border-border pt-10">
      <div className="h-3 w-24 animate-pulse rounded-sm bg-muted" />
      <div className="h-64 w-full animate-pulse rounded-sm bg-muted" />
      <div className="h-12 w-full animate-pulse rounded-sm bg-muted" />
    </div>
  )
}
