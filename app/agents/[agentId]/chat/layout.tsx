import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { requireSession } from '@/auth/server/auth-guard'
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
    <div className="flex h-[42rem] min-h-0 min-w-0 flex-col overflow-hidden">
      <Suspense fallback={children}>
        <OwnershipGate params={params}>{children}</OwnershipGate>
      </Suspense>
    </div>
  )
}

async function OwnershipGate({
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
  return children
}
