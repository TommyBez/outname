import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { ChatFrame } from '@/components/chat-frame'
import { requireSession } from '@/lib/auth-guard'
import { getCachedAgentByIdForUser } from '@/lib/data'

type Params = Promise<{ agentId: string }>

/**
 * Shared chrome for every chat URL. Resolves the agent row, enforces
 * ownership + chat capability, and wraps the active conversation in
 * the compact `<ChatFrame>` (header + full-height chat column). The
 * sidebar workspace section comes from the parent agent layout, so
 * Chat inherits contextual navigation without any extra plumbing.
 *
 * Kept fully suspended so the page below us can stream in alongside
 * the frame, matching the pattern the overview and edit surfaces use.
 */
export default function ChatRouteLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Params
}) {
  return (
    <Suspense fallback={<ChatFrameSkeleton>{children}</ChatFrameSkeleton>}>
      <ResolvedChatFrame params={params}>{children}</ResolvedChatFrame>
    </Suspense>
  )
}

async function ResolvedChatFrame({
  children,
  params,
}: {
  children: React.ReactNode
  params: Params
}) {
  const { agentId } = await params
  const session = await requireSession()
  const agent = await getCachedAgentByIdForUser(agentId, session.user.id)
  if (!agent) {
    notFound()
  }

  return (
    <ChatFrame
      agentId={agent.id}
      agentName={agent.name}
      enabled={agent.enabled}
    >
      {children}
    </ChatFrame>
  )
}

function ChatFrameSkeleton({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full min-w-0 flex-col gap-4">
      <div className="flex items-center justify-between gap-3 border-border border-b pb-4">
        <div className="h-4 w-40 animate-pulse rounded-sm bg-muted" />
        <div className="size-8 animate-pulse rounded-md bg-muted" />
      </div>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  )
}
