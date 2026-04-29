import Link from 'next/link'
import { Suspense } from 'react'
import { AgentTodayCard } from '@/components/agent-today-card'
import { AppShell } from '@/components/app-shell'
import { AgentCardSkeleton, RunResultSkeleton } from '@/components/skeletons'
import { TodayDate } from '@/components/today-date'
import { requireSession } from '@/lib/auth-guard'
import { getCachedAgentsForUser, getCachedLatestRunForAgent } from '@/lib/data'
import type { Agent } from '@/lib/db/schema'

export default function DashboardPage() {
  return (
    <AppShell>
      <header className="mb-12 border-foreground border-t-4 pt-6 md:mb-16">
        <div className="grid gap-8 md:grid-cols-[minmax(0,7fr)_minmax(14rem,3fr)] md:items-end">
          <div>
            <p className="swiss-label mb-4 text-accent">
              01. <TodayDate />
            </p>
            <h1 className="text-balance font-black font-serif text-6xl uppercase leading-[0.86] tracking-tighter md:text-8xl lg:text-[9rem]">
              Today
            </h1>
          </div>
          <p className="max-w-xs border-foreground border-l-2 pl-4 text-muted-foreground text-sm leading-relaxed">
            Current agents, latest run state, and the next manual action in one
            objective scan.
          </p>
          <Link
            className="inline-flex h-14 shrink-0 items-center justify-center self-start border-2 border-foreground bg-foreground px-6 font-bold text-background text-xs uppercase tracking-[0.16em] transition-colors hover:border-accent hover:bg-accent hover:text-foreground md:self-auto"
            href="/agents/new"
          >
            + New agent
          </Link>
        </div>
      </header>

      <Suspense fallback={<DashboardContentFallback />}>
        <DashboardContent />
      </Suspense>
    </AppShell>
  )
}

async function DashboardContent() {
  const session = await requireSession()

  return (
    <Suspense fallback={<RunResultSkeleton />}>
      <AgentsList userId={session.user.id} />
    </Suspense>
  )
}

async function AgentsList({ userId }: { userId: string }) {
  const agents = await getCachedAgentsForUser(userId)

  if (agents.length === 0) {
    return (
      <div className="swiss-dots border-2 border-foreground bg-muted p-8 md:p-12">
        <p className="font-black font-serif text-3xl uppercase leading-none tracking-tighter">
          No agents yet.
        </p>
        <p className="mt-4 max-w-md text-muted-foreground text-sm leading-relaxed">
          Create your first agent to start automating recurring work.
        </p>
        <Link
          className="mt-8 inline-flex h-14 items-center justify-center border-2 border-foreground bg-foreground px-6 font-bold text-background text-xs uppercase tracking-[0.16em] transition-colors hover:border-accent hover:bg-accent hover:text-foreground"
          href="/agents/new"
        >
          Create agent
        </Link>
      </div>
    )
  }

  return (
    <ul className="border-foreground border-y-2">
      {agents.map((a) => (
        <li key={a.id}>
          <Suspense fallback={<AgentCardSkeleton />}>
            <AgentCardContainer agent={a} />
          </Suspense>
        </li>
      ))}
    </ul>
  )
}

async function AgentCardContainer({ agent }: { agent: Agent }) {
  const latest = await getCachedLatestRunForAgent(agent.id)
  return <AgentTodayCard agent={agent} latestRun={latest} />
}

function DashboardContentFallback() {
  return <RunResultSkeleton />
}
