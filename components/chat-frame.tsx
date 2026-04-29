import { ChatHeader } from '@/components/chat-header'

interface ChatFrameProps {
  agentId: string
  agentName: string
  children: React.ReactNode
  enabled: boolean
}

/**
 * Shared chrome for every chat route: compact header on top, conversation
 * body filling the rest of the available height. Rendered inside
 * `app/agents/[agentId]/chat/layout.tsx` so all chat URLs get the same
 * frame while the page itself only worries about the conversation.
 *
 * The outer div is a fixed-height flex column so the inner `<AgentChat>`
 * can `flex-1` its conversation area and pin its composer to the bottom
 * of the chat column.
 */
export function ChatFrame({
  agentId,
  agentName,
  enabled,
  children,
}: ChatFrameProps) {
  return (
    <div className="flex h-full min-w-0 flex-col gap-5">
      <ChatHeader agentId={agentId} agentName={agentName} enabled={enabled} />
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  )
}
