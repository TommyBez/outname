import { listAgentEventSummariesByAgent } from '@outname/ai/agent-runtime/server/agent-event-summaries'
import {
  type AgentEventSummary,
  isTerminalAgentEventStatus,
} from '@outname/ai/agent-runtime/shared/event-types'
import { requireSession } from '@outname/auth/server/auth-guard'
import type { Agent } from '@outname/db/schema'
import {
  AgentDashboardCard,
  type DashboardAgent,
} from '@outname/shared/agents/components/agent-dashboard-card'
import { NewAgentLink } from '@outname/shared/agents/components/new-agent-link'
import { canCreateAgentForUser } from '@outname/shared/agents/server/creation-limit-access'
import { BudgetIndicator } from '@outname/shared/budgets/components/budget-indicator'
import {
  loadAgentBudgetSummaries,
  loadBudgetSummary,
} from '@outname/shared/budgets/server/summary'
import type { BudgetSummaryEntry } from '@outname/shared/budgets/server/types'
import { getCachedAgentsForUser } from '@outname/shared/server/data'
import { createPrivatePageMetadata } from '@outname/shared/server/site-metadata'
import { getUserTimeDisplay } from '@outname/shared/server/user-time-display'
import {
  AgentCardSkeleton,
  RunResultSkeleton,
} from '@outname/ui/components/skeletons'
import { TodayDate } from '@outname/ui/components/today-date'
import { Button } from '@outname/ui/components/ui/button'
import Link from 'next/link'
import { Suspense } from 'react'
import { DashboardAutoRefresh } from './dashboard-auto-refresh'

export const metadata = createPrivatePageMetadata(
  'Dashboard',
  'Monitor personal AI agents, event state, budgets, and attention in one private OUTNA.ME operator view.'
)

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardPageFallback />}>
      <DashboardPageBody />
    </Suspense>
  )
}

async function DashboardPageBody() {
  const session = await requireSession()
  const [display, agents] = await Promise.all([
    getUserTimeDisplay(session.user.id),
    getCachedAgentsForUser(session.user.id),
  ])
  const canCreateAgent = await canCreateAgentForUser({
    agentCount: agents.length,
    userId: session.user.id,
  })
  const todayLabel = display.longDate(new Date())

  return (
    <>
      <header className="mb-12 pt-6 md:mb-16">
        <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(14rem,18rem)] xl:items-end">
          <div className="min-w-0">
            <p className="swiss-label mb-4 text-muted-foreground">
              <TodayDate label={todayLabel} />
            </p>
            <h1 className="text-balance font-semibold text-3xl tracking-tight">
              Dashboard
            </h1>
          </div>
          <div className="flex flex-col items-start gap-6 xl:items-stretch xl:justify-self-end">
            <p className="max-w-xs text-muted-foreground text-sm leading-relaxed">
              Live cockpit for event queues, budgets, and agents that need
              attention.
            </p>
            <NewAgentLink canCreate={canCreateAgent} className="self-start">
              + New agent
            </NewAgentLink>
          </div>
        </div>
      </header>

      <Suspense fallback={<RunResultSkeleton />}>
        <DashboardCockpit
          agents={agents}
          canCreateAgent={canCreateAgent}
          timeZone={display.timeZone}
          userId={session.user.id}
        />
      </Suspense>
    </>
  )
}
async function DashboardCockpit({
  agents,
  canCreateAgent,
  timeZone,
  userId,
}: {
  agents: Agent[]
  canCreateAgent: boolean
  timeZone: string
  userId: string
}) {
  if (agents.length === 0) {
    return (
      <div className="border border-border bg-muted p-8 md:p-12">
        <p className="font-semibold text-xl tracking-tight">No agents yet.</p>
        <p className="mt-4 max-w-md text-muted-foreground text-sm leading-relaxed">
          Create your first agent to start automating recurring work.
        </p>
        <NewAgentLink canCreate={canCreateAgent} className="mt-8">
          Create agent
        </NewAgentLink>
      </div>
    )
  }

  const enabledCount = agents.filter((agent) => agent.enabled).length
  const pausedCount = agents.length - enabledCount
  const pausedAgents = agents.filter((agent) => !agent.enabled)
  const monitorAgents = agents.filter((agent) => agent.enabled)
  const monitorAgentIds = monitorAgents.map((a) => a.id)
  const [generalBudget, agentBudgetMap, agentEventMap] = await Promise.all([
    loadBudgetSummary({
      userId,
      scope: { type: 'general' },
    }),
    loadAgentBudgetSummaries({
      userId,
      agentIds: monitorAgentIds,
    }),
    listAgentEventSummariesByAgent({
      agentIds: monitorAgentIds,
      limit: 25,
    }),
  ])
  let activeEventCount = 0
  for (const events of agentEventMap.values()) {
    for (const event of events) {
      if (isActiveDashboardEvent(event)) {
        activeEventCount += 1
      }
    }
  }
  const attentionAgentIds = new Set<string>()
  for (const agent of pausedAgents) {
    attentionAgentIds.add(agent.id)
  }
  for (const [agentId, events] of agentEventMap) {
    if (events.some(isFailedDashboardEvent)) {
      attentionAgentIds.add(agentId)
    }
  }
  for (const [agentId, entries] of agentBudgetMap) {
    if (entries.some(isBudgetAttention)) {
      attentionAgentIds.add(agentId)
    }
  }

  return (
    <section aria-labelledby="dashboard-cockpit-heading">
      <h2 className="sr-only" id="dashboard-cockpit-heading">
        Operational cockpit
      </h2>
      <DashboardAutoRefresh enabled={activeEventCount > 0} />

      <div className="mb-8 grid gap-4 border-border border-b py-5 sm:grid-cols-3">
        <DashboardMetric label="Active" value={enabledCount} />
        <DashboardMetric
          hint={activeEventCount > 0 ? 'Live · auto-refreshing' : undefined}
          label="In flight"
          value={activeEventCount}
        />
        <DashboardMetric label="Attention" value={attentionAgentIds.size} />
      </div>

      <div className="mb-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="border-border border-b pb-6">
          <div className="mb-4 flex items-center justify-between gap-4">
            <p className="font-bold text-[10px]">General budget</p>
            <Link
              className="font-bold text-[10px] text-muted-foreground hover:text-foreground"
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

        <div className="border-border border-l pl-4">
          <p className="font-bold text-[10px]">Quick actions</p>
          <div className="mt-4 grid gap-2">
            <NewAgentLink
              canCreate={canCreateAgent}
              className="w-full"
              size="sm"
              variant="outline"
            >
              New agent
            </NewAgentLink>
            <QuickAction href="/agents" label="Agent registry" />
            <QuickAction href="/channels" label="Channels" />
            <QuickAction href="/connections" label="Connections" />
            <QuickAction href="/settings" label="Settings" />
          </div>
          <p className="mt-5 font-mono text-muted-foreground text-xs">
            {pausedCount} paused · {enabledCount} active
          </p>
        </div>
      </div>

      <PausedAgentsQueue agents={pausedAgents} />

      <section className="mt-12">
        <div className="mb-5 flex flex-wrap items-baseline justify-between gap-4">
          <div>
            <p className="swiss-label text-muted-foreground">Run monitor</p>
            <h2 className="mt-3 font-semibold text-xl tracking-tight">
              Event-ready agents
            </h2>
          </div>
          <Link
            className="font-bold text-muted-foreground text-xs hover:text-foreground"
            href="/agents"
          >
            Open registry →
          </Link>
        </div>
        {monitorAgents.length === 0 ? (
          <p className="border-border border-b py-6 text-muted-foreground text-sm">
            No active agents yet.
          </p>
        ) : (
          <ul className="border-border border-b">
            {monitorAgents.map((agent) => (
              <li key={agent.id}>
                <Suspense fallback={<AgentCardSkeleton />}>
                  <AgentDashboardCard
                    agent={toDashboardAgent(agent)}
                    budgetEntries={agentBudgetMap.get(agent.id) ?? []}
                    eventSummaries={agentEventMap.get(agent.id) ?? []}
                    timeZone={timeZone}
                  />
                </Suspense>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  )
}

function PausedAgentsQueue({ agents }: { agents: Agent[] }) {
  if (agents.length === 0) {
    return (
      <section className="border-border border-b py-6">
        <p className="swiss-label text-muted-foreground">Paused agents</p>
        <p className="mt-3 text-muted-foreground text-sm">
          No paused agents right now.
        </p>
      </section>
    )
  }

  return (
    <section className="border-border border-b py-6">
      <p className="swiss-label text-muted-foreground">Paused agents</p>
      <ul className="mt-5 grid gap-3 md:grid-cols-2">
        {agents.map((agent) => (
          <li key={agent.id}>
            <Link
              className="block border border-border p-4 transition-colors hover:bg-accent"
              href={`/agents/${agent.id}`}
            >
              <p className="font-semibold text-xl leading-none tracking-tighter">
                {agent.name}
              </p>
              <p className="mt-2 font-mono text-muted-foreground text-xs">
                {agent.enabled ? 'Ready for events' : 'Paused'}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

function DashboardMetric({
  hint,
  label,
  value,
}: {
  hint?: string
  label: string
  value: number
}) {
  return (
    <div className="border-border border-l pl-4">
      <p className="font-bold text-[10px] text-muted-foreground">{label}</p>
      <p className="mt-2 font-semibold text-4xl tracking-tight">{value}</p>
      {hint ? (
        <p className="mt-1 font-mono text-[10px] text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

function QuickAction({ href, label }: { href: string; label: string }) {
  return (
    <Button asChild className="w-full" size="sm" variant="outline">
      <Link href={href}>{label}</Link>
    </Button>
  )
}

function isActiveDashboardEvent(event: AgentEventSummary): boolean {
  return !isTerminalAgentEventStatus(event.status)
}

function isFailedDashboardEvent(event: AgentEventSummary): boolean {
  return event.status === 'failed'
}

function isBudgetAttention(entry: BudgetSummaryEntry): boolean {
  if (!(entry.enabled && entry.limitUsd > 0)) {
    return false
  }
  return entry.spentUsd / entry.limitUsd >= 0.8
}

function DashboardPageFallback() {
  return (
    <>
      <header className="mb-12 pt-6 md:mb-16">
        <div className="h-24 animate-pulse bg-muted" />
      </header>
      <RunResultSkeleton />
    </>
  )
}

function toDashboardAgent(agent: Agent): DashboardAgent {
  return {
    enabled: agent.enabled,
    heartbeatEnabled: agent.heartbeatEnabled,
    heartbeatIntervalMinutes: agent.heartbeatIntervalMinutes,
    heartbeatScheduleMode: agent.heartbeatScheduleMode,
    heartbeatScheduleTimes: agent.heartbeatScheduleTimes,
    id: agent.id,
    lastHeartbeatAt: agent.lastHeartbeatAt?.toISOString() ?? null,
    lastDreamingAt: agent.lastDreamingAt?.toISOString() ?? null,
    model: agent.model,
    name: agent.name,
    dreamingEnabled: agent.dreamingEnabled,
  }
}
