import { Suspense } from "react"
import Link from "next/link"
import { requireSession } from "@/lib/auth-guard"
import {
  getCachedAgentsForUser,
  getCachedLatestRunForAgent,
} from "@/lib/data"
import { AppShell } from "@/components/app-shell"
import { TodayDate } from "@/components/today-date"
import { AgentTodayCard } from "@/components/agent-today-card"
import { AgentCardSkeleton, RunResultSkeleton } from "@/components/skeletons"
import type { Agent } from "@/lib/db/schema"

export default function DashboardPage() {
  return (
    <AppShell>
      <header className="mb-12 flex flex-col gap-2 md:mb-16">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
          <TodayDate />
        </p>
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <h1 className="font-serif text-4xl font-medium leading-[1.05] tracking-tight text-balance md:text-6xl">
            Today.
          </h1>
          <Link
            href="/agents/new"
            className="inline-flex shrink-0 items-center justify-center self-start rounded-md border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted md:self-auto"
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
      <div className="border-t border-border pt-10">
        <p className="font-serif text-2xl leading-snug">No agents yet.</p>
        <p className="mt-3 text-sm text-muted-foreground">
          Create your first agent to start automating recurring work.
        </p>
        <Link
          href="/agents/new"
          className="mt-6 inline-flex items-center justify-center rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90"
        >
          Create agent
        </Link>
      </div>
    )
  }

  return (
    <ul className="flex flex-col divide-y divide-border">
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
