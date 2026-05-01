import Link from 'next/link'
import { Suspense } from 'react'
import { AppShell } from '@/components/app-shell'
import { requireSession } from '@/lib/auth-guard'
import { getCachedAgentsForUser } from '@/lib/data'
import type { Agent } from '@/lib/db/schema'

export default function AgentsListPage() {
  return (
    <AppShell>
      <header className="mb-12 border-foreground border-t-4 pt-6">
        <div className="grid gap-8 md:grid-cols-[minmax(0,7fr)_minmax(14rem,3fr)] md:items-end">
          <div>
            <p className="swiss-label mb-4 text-accent">02. Agents</p>
            <h1 className="font-black font-serif text-6xl uppercase leading-[0.9] tracking-tighter md:text-8xl">
              Your agents
            </h1>
          </div>
          <p className="max-w-xs border-foreground border-l-2 pl-4 text-muted-foreground text-sm leading-relaxed">
            Each worker has its own model, schedules, memory, and reflection
            stream.
          </p>
          <Link
            className="inline-flex h-14 shrink-0 items-center justify-center self-start border-2 border-foreground bg-foreground px-6 font-bold text-background text-xs uppercase tracking-[0.16em] transition-colors hover:border-accent hover:bg-accent hover:text-foreground md:self-auto"
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

  if (agents.length === 0) {
    return (
      <div className="swiss-dots border-2 border-foreground bg-muted p-8 md:p-12">
        <p className="font-black font-serif text-3xl uppercase leading-none tracking-tighter">
          No agents yet.
        </p>
        <p className="mt-4 max-w-lg text-muted-foreground text-sm leading-relaxed">
          Add an agent to automate recurring work. Each agent runs on its own
          schedule and keeps its memory in a persistent sandbox.
        </p>
      </div>
    )
  }

  return (
    <ul className="border-foreground border-y-2">
      {agents.map((agent) => (
        <li key={agent.id}>
          <AgentListRow agent={agent} />
        </li>
      ))}
    </ul>
  )
}

function AgentListRow({ agent }: { agent: Agent }) {
  return (
    <Link
      className="group grid grid-cols-1 gap-4 border-foreground border-b-2 py-6 transition-colors last:border-b-0 hover:bg-accent md:grid-cols-[1fr_auto_auto] md:items-center md:gap-8 md:px-4"
      href={`/agents/${agent.id}`}
    >
      <div className="flex min-w-0 flex-col gap-1">
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 font-bold text-[10px] text-muted-foreground uppercase tracking-[0.2em] group-hover:text-foreground">
          <span>{agent.model}</span>
          {!agent.enabled && (
            <span className="border border-border px-1.5 py-0.5 text-[10px] tracking-wider">
              PAUSED
            </span>
          )}
        </p>
        <p className="text-pretty font-black font-serif text-2xl uppercase leading-none tracking-tighter">
          {agent.name}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-muted-foreground text-xs group-hover:text-foreground md:flex-col md:items-end md:gap-y-1">
        <span>{agent.heartbeatEnabled ? 'Heartbeat on' : 'Heartbeat off'}</span>
        <span>
          {agent.reflectionEnabled ? 'Reflection on' : 'Reflection off'}
        </span>
      </div>
      <span
        aria-hidden
        className="hidden font-bold text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-foreground md:inline-block"
      >
        →
      </span>
    </Link>
  )
}

function AgentsListSkeleton() {
  return (
    <ul className="border-foreground border-y-2">
      {[0, 1].map((i) => (
        <li
          className="grid grid-cols-1 gap-4 border-foreground border-b-2 py-6 last:border-b-0 md:grid-cols-[1fr_auto_auto] md:items-center md:gap-8 md:px-4"
          key={i}
        >
          <div className="flex flex-col gap-2">
            <div className="h-3 w-32 animate-pulse bg-muted" />
            <div className="h-6 w-56 animate-pulse bg-muted" />
          </div>
          <div className="h-3 w-20 animate-pulse bg-muted" />
          <div className="h-3 w-24 animate-pulse bg-muted" />
        </li>
      ))}
    </ul>
  )
}
