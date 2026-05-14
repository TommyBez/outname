import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { requireSession } from '@/auth/server/auth-guard'
import { ChatFrame } from '@/chat/components/chat-frame'
import { getCachedAgentByIdForUser } from '@/shared/server/data'

type Params = Promise<{ agentId: string }>

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
    <div className="flex h-[42rem] min-h-0 min-w-0 flex-col overflow-hidden">
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  )
}
