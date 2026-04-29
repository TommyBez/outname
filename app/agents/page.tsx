import Link from 'next/link'
import { Suspense } from 'react'
import { AppShell } from '@/components/app-shell'
import { requireSession } from '@/lib/auth-guard'
import { getCachedAgentsForUser, getCachedLatestRunForAgent } from '@/lib/data'
import type { Agent, Run } from '@/lib/db/schema'
import { formatRelative } from '@/lib/format'

export default function AgentsListPage() {
  return (
    <AppShell>
      <header className="mb-10 flex flex-col gap-2 md:mb-12">
        <p className="font-mono text-muted-foreground text-xs uppercase tracking-[0.2em]">
          Agents
        </p>
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <h1 className="font-medium font-serif text-4xl leading-tight tracking-tight md:text-5xl">
            Your agents.
          </h1>
          <Link
            className="inline-flex shrink-0 items-center justify-center self-start rounded-md bg-foreground px-4 py-2 font-medium text-background text-sm transition-opacity hover:opacity-90 md:self-auto"
            href="/agents/new"
          >
            + New agent
          </Link>
        </div>
      </header>

      <Suspense fallback={<AgentsListSkeleton />}>
        <AgentsListBody />
      </Suspense>
    </AppShell>
  )
}

async function AgentsListBody() {
  const session = await requireSession()
  const agents = await getCachedAgentsForUser(session.user.id)

  // Parallelize latest-run lookups
  const withLatest = await Promise.all(
    agents.map(async (a) => ({
      agent: a,
      latest: await getCachedLatestRunForAgent(a.id),
    }))
  )

  if (withLatest.length === 0) {
    return (
      <div className="border-border border-t pt-10">
        <p className="font-serif text-2xl leading-snug">No agents yet.</p>
        <p className="mt-3 text-muted-foreground text-sm">
          Add an agent to automate recurring work. Each agent runs on its own
          schedule and keeps its memory in a persistent sandbox.
        </p>
      </div>
    )
  }

  return (
    <ul className="flex flex-col divide-y divide-border border-border border-y">
      {withLatest.map(({ agent, latest }) => (
        <li key={agent.id}>
          <AgentListRow agent={agent} latest={latest} />
        </li>
      ))}
    </ul>
  )
}

function AgentListRow({ agent, latest }: { agent: Agent; latest: Run | null }) {
  return (
    <Link
      className="grid grid-cols-1 gap-3 py-6 transition-colors hover:bg-muted/40 md:grid-cols-[1fr_auto_auto] md:items-center md:gap-8 md:px-2"
      href={`/agents/${agent.id}`}
    >
      <div className="flex min-w-0 flex-col gap-1">
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-muted-foreground text-xs uppercase tracking-[0.2em]">
          <span>{agent.model}</span>
          {!agent.enabled && (
            <span className="rounded-sm border border-border px-1.5 py-0.5 text-[10px] tracking-wider">
              PAUSED
            </span>
          )}
        </p>
        <p className="text-pretty font-medium font-serif text-xl leading-tight">
          {agent.name}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-muted-foreground text-xs md:flex-col md:items-end md:gap-y-1">
        <span>{latest ? formatRelative(latest.startedAt) : 'Never run'}</span>
      </div>
      <span
        aria-hidden
        className="hidden text-muted-foreground md:inline-block"
      >
        →
      </span>
    </Link>
  )
}

function AgentsListSkeleton() {
  return (
    <ul className="flex flex-col divide-y divide-border border-border border-y">
      {[0, 1].map((i) => (
        <li
          className="grid grid-cols-1 gap-4 py-6 md:grid-cols-[1fr_auto_auto] md:items-center md:gap-8 md:px-2"
          key={i}
        >
          <div className="flex flex-col gap-2">
            <div className="h-3 w-32 animate-pulse rounded-sm bg-muted" />
            <div className="h-6 w-56 animate-pulse rounded-sm bg-muted" />
          </div>
          <div className="h-3 w-20 animate-pulse rounded-sm bg-muted" />
          <div className="h-3 w-24 animate-pulse rounded-sm bg-muted" />
        </li>
      ))}
    </ul>
  )
}
