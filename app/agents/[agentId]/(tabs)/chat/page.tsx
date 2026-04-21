import { notFound } from "next/navigation"
import { requireSession } from "@/lib/auth-guard"
import { getAgentByIdForUser } from "@/lib/data"
import {
  getConversationForAgent,
  loadConversationMessages,
} from "@/lib/agent-chat"
import { getAgentRuntime } from "@/lib/agent-runtime-registry"
import { AgentChat } from "@/components/agent-chat"
import type { AgentKind } from "@/lib/db/schema"

type Params = Promise<{ agentId: string }>

/**
 * Chat surface for an agent. Loads history server-side (once per request)
 * and hands it to the client component, which owns transport + streaming.
 *
 * If the agent's kind does not expose a chat factory, we 404 rather than
 * render a broken page — the tab is already visually disabled upstream.
 */
export default async function AgentChatPage({ params }: { params: Params }) {
  const { agentId } = await params
  const session = await requireSession()
  const agent = await getAgentByIdForUser(agentId, session.user.id)
  if (!agent) notFound()

  const runtime = getAgentRuntime(agent.kind as AgentKind)
  if (!runtime?.buildAgent) notFound()

  const conversation = await getConversationForAgent(agent.id)
  const initialMessages = conversation
    ? await loadConversationMessages(conversation.id)
    : []

  return (
    <div className="flex flex-col">
      <AgentChat agentId={agent.id} initialMessages={initialMessages} />
    </div>
  )
}
