import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import { Suspense } from 'react'
import { listAgentEventSummaries } from '@/agent-runtime/server/agent-event-summaries'
import { AgentEventsWorkspace } from '@/agents/components/agent-events-workspace'
import { requireSession } from '@/auth/server/auth-guard'
import { getCachedAgentByIdForUser } from '@/shared/server/data'

type Params = Promise<{ agentId: string }>

export default async function AgentEventsPage({ params }: { params: Params }) {
  await connection()
  const { agentId } = await params
  const session = await requireSession()
  const agent = await getCachedAgentByIdForUser(agentId, session.user.id)
  if (!agent) {
    notFound()
  }

  const events = await listAgentEventSummaries({
    agentId: agent.id,
    limit: 50,
  })

  return (
    <Suspense fallback={<EventsSkeleton />}>
      <AgentEventsWorkspace agentId={agent.id} initialEvents={events} />
    </Suspense>
  )
}

function EventsSkeleton() {
  return (
    <div className="grid min-h-[38rem] gap-6 xl:grid-cols-[24rem_minmax(0,1fr)]">
      <div className="animate-pulse border-2 border-foreground bg-muted" />
      <div className="animate-pulse border-2 border-foreground bg-muted" />
    </div>
  )
}
