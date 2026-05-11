import Link from 'next/link'
import { Suspense } from 'react'
import {
  AgentDashboardCard,
  type DashboardAgent,
} from '@/agents/components/agent-dashboard-card'
import { requireSession } from '@/auth/server/auth-guard'
import { BudgetIndicator } from '@/budgets/components/budget-indicator'
import { loadBudgetSummary } from '@/budgets/server/summary'
import type { BudgetSummaryEntry } from '@/budgets/server/types'
import { AppShell } from '@/shared/components/layout/app-shell'
import {
  AgentCardSkeleton,
  RunResultSkeleton,
} from '@/shared/components/skeletons'
import { TodayDate } from '@/shared/components/today-date'
import type { Agent } from '@/shared/db/schema'
import { getCachedAgentsForUser } from '@/shared/server/data'
import { createPrivatePageMetadata } from '@/shared/server/site-metadata'

export const metadata = createPrivatePageMetadata(
  'Dashboard',
  'Monitor personal AI agents, session state, and live activity in one private OUTNA.ME operator view.'
)

export default function DashboardPage() {
  return (
    <AppShell>
      <header className="mb-12 border-foreground border-t-4 pt-6 md:mb-16">
        <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(14rem,18rem)] xl:items-end">
          <div className="min-w-0">
            <p className="swiss-label mb-4 text-accent">
              01. <TodayDate />
            </p>
            <h1 className="text-balance font-black font-serif text-6xl uppercase leading-[0.86] tracking-tighter md:text-[clamp(4.5rem,7vw,7rem)]">
              Dashboard
            </h1>
          </div>
          <div className="flex flex-col items-start gap-6 xl:items-stretch xl:justify-self-end">
            <p className="max-w-xs border-foreground border-l-2 pl-4 text-muted-foreground text-sm leading-relaxed">
              Every agent, current session state, and live activity in one
              operator view.
            </p>
            <Link
              className="inline-flex h-14 shrink-0 items-center justify-center border-2 border-foreground bg-foreground px-6 font-bold text-background text-xs uppercase tracking-[0.16em] transition-colors hover:border-accent hover:bg-accent hover:text-foreground"
              href="/agents/new"
            >
              + New agent
            </Link>
          </div>
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
  const [agents, generalBudget] = await Promise.all([
    getCachedAgentsForUser(userId),
    loadBudgetSummary({ userId, scope: { type: 'general' } }),
  ])

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

  const enabledCount = agents.filter((agent) => agent.enabled).length
  const sessionCount = agents.filter((agent) => agent.lastSessionRunId).length
  const agentBudgets = await Promise.all(
    agents.map(async (a) => ({
      agentId: a.id,
      entries: await loadBudgetSummary({
        userId,
        scope: { type: 'agent', agentId: a.id },
      }),
    }))
  )
  const agentBudgetMap = new Map<string, BudgetSummaryEntry[]>(
    agentBudgets.map((b) => [b.agentId, b.entries])
  )

  return (
    <section aria-labelledby="agent-dashboard-heading">
      <div className="mb-8 grid gap-4 border-foreground border-y-2 py-5 sm:grid-cols-3">
        <DashboardMetric label="Agents" value={agents.length} />
        <DashboardMetric label="Enabled" value={enabledCount} />
        <DashboardMetric label="Sessions" value={sessionCount} />
      </div>
      <div className="mb-8 border-foreground border-b-2 pb-5">
        <div className="mb-4 flex items-center justify-between gap-4">
          <p className="font-bold text-[10px] uppercase tracking-[0.2em]">
            General budget
          </p>
          <Link
            className="font-bold text-[10px] text-muted-foreground uppercase tracking-[0.18em] hover:text-foreground"
            href="/settings"
          >
            Manage →
          </Link>
        </div>
        <BudgetIndicator
          emptyHref="/settings"
          emptyLabel="No general budget set · configure →"
          entries={generalBudget}
          variant="general"
        />
      </div>
      <h2 className="sr-only" id="agent-dashboard-heading">
        Agent activity dashboard
      </h2>
      <ul className="border-foreground border-y-2">
        {agents.map((agent) => (
          <li key={agent.id}>
            <Suspense fallback={<AgentCardSkeleton />}>
              <AgentDashboardCard
                agent={toDashboardAgent(agent)}
                budgetEntries={agentBudgetMap.get(agent.id) ?? []}
              />
            </Suspense>
          </li>
        ))}
      </ul>
    </section>
  )
}

function DashboardMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="border-foreground border-l-2 pl-4">
      <p className="font-bold text-[10px] text-muted-foreground uppercase tracking-[0.2em]">
        {label}
      </p>
      <p className="mt-2 font-black font-serif text-4xl leading-none tracking-tighter">
        {value}
      </p>
    </div>
  )
}

function DashboardContentFallback() {
  return <RunResultSkeleton />
}

function toDashboardAgent(agent: Agent): DashboardAgent {
  return {
    enabled: agent.enabled,
    heartbeatEnabled: agent.heartbeatEnabled,
    heartbeatIntervalMinutes: agent.heartbeatIntervalMinutes,
    id: agent.id,
    lastHeartbeatAt: agent.lastHeartbeatAt?.toISOString() ?? null,
    lastReflectionAt: agent.lastReflectionAt?.toISOString() ?? null,
    lastSessionRunId: agent.lastSessionRunId,
    model: agent.model,
    name: agent.name,
    reflectionEnabled: agent.reflectionEnabled,
  }
}
