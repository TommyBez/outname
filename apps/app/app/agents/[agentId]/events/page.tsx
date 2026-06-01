import { listAgentEventSummaries } from '@outname/ai/agent-runtime/server/agent-event-summaries'
import { TERMINAL_LEDGER_EVENTS_PER_TYPE } from '@outname/ai/agent-runtime/shared/compact-ledger-events'
import { requireSession } from '@outname/auth/server/auth-guard'
import { AgentEventsWorkspace } from '@outname/shared/agents/components/agent-events-workspace'
import { getCachedAgentByIdForUser } from '@outname/shared/server/data'
import { createPrivatePageMetadata } from '@outname/shared/server/site-metadata'
import { getUserTimeDisplay } from '@outname/shared/server/user-time-display'
import { Skeleton } from '@outname/ui/components/ui/skeleton'
import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import { Suspense } from 'react'

type Params = Promise<{ agentId: string }>

export const metadata = createPrivatePageMetadata(
  'Agent events',
  'Inspect private OUTNA.ME agent event history and workflow traces.'
)

export default async function AgentEventsPage({ params }: { params: Params }) {
  const [, { agentId }, session] = await Promise.all([
    connection(),
    params,
    requireSession(),
  ])
  const [agent, display] = await Promise.all([
    getCachedAgentByIdForUser(agentId, session.user.id),
    getUserTimeDisplay(session.user.id),
  ])
  if (!agent) {
    notFound()
  }

  const events = await listAgentEventSummaries({
    agentId: agent.id,
    limit: 50,
    reconcileActive: false,
    terminalEventsPerType: TERMINAL_LEDGER_EVENTS_PER_TYPE,
  })

  return (
    <Suspense fallback={<EventsSkeleton />}>
      <AgentEventsWorkspace
        agentId={agent.id}
        initialEvents={events}
        timeZone={display.timeZone}
      />
    </Suspense>
  )
}

function EventsSkeleton() {
  return (
    <div className="grid gap-6 xl:grid-cols-[24rem_minmax(0,1fr)]">
      <Skeleton className="h-[min(42rem,calc(100svh-12rem))] min-h-80 border-2 border-foreground xl:h-168" />
      <Skeleton className="h-[min(42rem,calc(100svh-10rem))] min-h-96 border-2 border-foreground xl:h-168" />
    </div>
  )
}
