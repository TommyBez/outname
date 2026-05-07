import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { TriggerButton } from '@/components/trigger-button'
import { requireSession } from '@/lib/auth-guard'
import { getCachedAgentByIdForUser } from '@/lib/data'
import type { Agent } from '@/lib/db/schema'

/**
 * Stringify a heartbeat interval into a compact, human-readable label
 * for the overview header. Falls back to the raw minute count for
 * non-canonical values.
 */
function formatInterval(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`
  }
  if (minutes === 60) {
    return '1 hour'
  }
  if (minutes % 60 === 0) {
    const hours = minutes / 60
    if (hours === 24) {
      return '1 day'
    }
    return `${hours} hours`
  }
  return `${minutes} min`
}

type Params = Promise<{ agentId: string }>

/**
 * Full agent overview surface: kind badge, name, schedule, primary
 * actions, last-run state, and run history. Rendered by both
 * `/agents/:id` (for non-chat kinds) and `/agents/:id/about` so the
 * content stays in one place.
 *
 * Owns its own `<Suspense>` boundary so the chat-capable redirect path
 * on `/agents/:id` doesn't pay for its data fetches when it's only going
 * to navigate away.
 */
export function AgentOverview({ params }: { params: Params }) {
  return (
    <Suspense fallback={<OverviewSkeleton />}>
      <ResolvedAgentOverview params={params} />
    </Suspense>
  )
}

async function ResolvedAgentOverview({ params }: { params: Params }) {
  const { agentId } = await params
  const session = await requireSession()
  const agent = await getCachedAgentByIdForUser(agentId, session.user.id)
  if (!agent) {
    notFound()
  }

  return <AgentOverviewHeader agent={agent} />
}

function AgentOverviewHeader({ agent }: { agent: Agent }) {
  return (
    <header className="mb-12 border-foreground border-t-4 pt-6">
      <div className="grid gap-8 md:grid-cols-[minmax(0,7fr)_minmax(16rem,3fr)]">
        <div className="flex flex-col gap-4">
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 font-bold text-[10px] text-muted-foreground uppercase tracking-[0.2em]">
            <span>{agent.model}</span>
            {agent.heartbeatEnabled ? (
              <span>
                · heartbeat every{' '}
                {formatInterval(agent.heartbeatIntervalMinutes)}
              </span>
            ) : (
              <span>· heartbeat off</span>
            )}
            {!agent.enabled && (
              <span className="border border-border px-1.5 py-0.5 text-[10px] tracking-wider">
                PAUSED
              </span>
            )}
            {agent.reflectionEnabled ? (
              <span>
                · reflection every{' '}
                {formatInterval(agent.reflectionIntervalMinutes)}
              </span>
            ) : (
              <span>· reflection off</span>
            )}
          </p>
          <h1 className="font-black font-serif text-5xl uppercase leading-[0.9] tracking-tighter md:text-7xl">
            {agent.name}
          </h1>
        </div>
        <div className="flex flex-wrap items-start gap-3 border-foreground border-l-2 pl-4 md:justify-end">
          <TriggerButton agentId={agent.id} label="Run heartbeat" />
          <TriggerButton
            agentId={agent.id}
            label="Run reflection"
            mode="reflection"
            variant="outline"
          />
          <Link
            className="inline-flex h-10 items-center justify-center border-2 border-foreground px-4 font-bold text-xs uppercase tracking-[0.16em] transition-colors hover:bg-foreground hover:text-background"
            href={`/agents/${agent.id}/edit`}
          >
            Configure →
          </Link>
        </div>
      </div>
    </header>
  )
}

function OverviewSkeleton() {
  return (
    <>
      <header className="mb-10 flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <div className="h-3 w-24 animate-pulse rounded-sm bg-muted" />
          <div className="h-10 w-64 animate-pulse rounded-sm bg-muted" />
        </div>
        <div className="flex items-center gap-3">
          <div className="h-9 w-24 animate-pulse rounded-md bg-muted" />
          <div className="h-9 w-24 animate-pulse rounded-md bg-muted" />
        </div>
      </header>
      <div className="mb-6 h-3 w-20 animate-pulse rounded-sm bg-muted" />
      <div className="h-48 w-full animate-pulse rounded-sm bg-muted" />
    </>
  )
}
