import { Suspense } from "react"
import { notFound } from "next/navigation"
import { requireSession } from "@/lib/auth-guard"
import { getAgentByIdForUser } from "@/lib/data"
import {
  getConversationForAgent,
  loadChatHistory,
} from "@/lib/agent-chat"
import { getAgentRuntime } from "@/lib/agent-runtime-registry"
import { AgentChat } from "@/components/agent-chat"
import type { AgentKind } from "@/lib/db/schema"

type Params = Promise<{ agentId: string; conversationId: string }>

/**
 * Active chat pane for a persisted conversation. Mounted inside the
 * chat layout's `<main>`, which is siblings with the sessions sidebar.
 * Ownership is double-checked here (agent belongs to user, conversation
 * belongs to agent) so a guessed URL returns 404 rather than leaking
 * somebody else's transcript.
 */
export default function AgentConversationPage({
  params,
}: {
  params: Params
}) {
  return (
    <Suspense fallback={<ChatSkeleton />}>
      <ConversationShell params={params} />
    </Suspense>
  )
}

async function ConversationShell({ params }: { params: Params }) {
  const { agentId, conversationId } = await params
  const session = await requireSession()
  const agent = await getAgentByIdForUser(agentId, session.user.id)
  if (!agent) notFound()

  const runtime = getAgentRuntime(agent.kind as AgentKind)
  if (!runtime?.buildAgent) notFound()

  const conversation = await getConversationForAgent(conversationId, agent.id)
  if (!conversation) notFound()

  const initialMessages = await loadChatHistory(conversation.id)
  console.log("[v0] chat load", {
    conversationId: conversation.id,
    title: conversation.title,
    count: initialMessages.length,
    roles: initialMessages.map((m) => m.role),
    ids: initialMessages.map((m) => m.id),
    partsCounts: initialMessages.map((m) => m.parts?.length ?? 0),
  })

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
    <div className="flex flex-col gap-3">
      <div className="h-3 w-24 animate-pulse rounded-sm bg-muted" />
      <div className="h-64 w-full animate-pulse rounded-sm bg-muted" />
      <div className="h-12 w-full animate-pulse rounded-sm bg-muted" />
    </div>
  )
}
