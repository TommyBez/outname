import Link from 'next/link'
import { Suspense } from 'react'
import { listAgentEventSummaries } from '@/agent-runtime/server/agent-event-summaries'
import {
  type AgentEventSummary,
  isTerminalAgentEventStatus,
} from '@/agent-runtime/shared/event-types'
import {
  AgentDashboardCard,
  type DashboardAgent,
} from '@/agents/components/agent-dashboard-card'
import { requireSession } from '@/auth/server/auth-guard'
import { BudgetIndicator } from '@/budgets/components/budget-indicator'
import { loadBudgetSummary } from '@/budgets/server/summary'
import type { BudgetSummaryEntry } from '@/budgets/server/types'
import { AiGatewayKeyGateProvider } from '@/shared/components/ai-gateway-key-gate/ai-gateway-key-gate-provider'
import { NewAgentLink } from '@/shared/components/ai-gateway-key-gate/new-agent-link'
import { QuickActionLink } from '@/shared/components/ai-gateway-key-gate/quick-action-link'
import { AppShell } from '@/shared/components/layout/app-shell'
import {
  AgentCardSkeleton,
  RunResultSkeleton,
} from '@/shared/components/skeletons'
import { TodayDate } from '@/shared/components/today-date'
import type { Agent } from '@/shared/db/schema'
import { hasUserAiGatewayApiKey } from '@/shared/server/ai-gateway-byok'
import { getCachedAgentsForUser } from '@/shared/server/data'
import { createPrivatePageMetadata } from '@/shared/server/site-metadata'
import { getUserTimeDisplay } from '@/shared/server/user-time-display'

export const metadata = createPrivatePageMetadata(
  'Dashboard',
  'Monitor personal AI agents, event state, budgets, and attention in one private OUTNA.ME operator view.'
)

export default function DashboardPage() {
  return (
    <AppShell>
      <Suspense fallback={<DashboardPageFallback />}>
        <DashboardPageBody />
      </Suspense>
    </AppShell>
  )
}

async function DashboardPageBody() {
  const session = await requireSession()
  const [display, hasKey] = await Promise.all([
    getUserTimeDisplay(session.user.id),
    hasUserAiGatewayApiKey(session.user.id),
  ])

  return (
    <AiGatewayKeyGateProvider initialHasKey={hasKey}>
      <div>
        <header className="mb-12 border-foreground border-t-4 pt-6 md:mb-16">
          <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(14rem,18rem)] xl:items-end">
            <div className="min-w-0">
              <p className="swiss-label mb-4 text-accent">
                01. <TodayDate label={display.longDate(new Date())} />
              </p>
              <h1 className="text-balance font-black font-serif text-5xl uppercase leading-[0.86] tracking-tighter sm:text-6xl lg:text-[clamp(4.5rem,7vw,7rem)]">
                Dashboard
              </h1>
            </div>
            <div className="flex flex-col items-start gap-6 xl:items-stretch xl:justify-self-end">
              <p className="max-w-xs border-foreground border-l-2 pl-4 text-muted-foreground text-sm leading-relaxed">
                Live cockpit for event queues, budgets, and agents that need
                attention.
              </p>
              <NewAgentLink className="inline-flex h-14 shrink-0 items-center justify-center border-2 border-foreground bg-foreground px-6 font-bold text-background text-xs uppercase tracking-[0.16em] transition-colors hover:border-accent hover:bg-accent hover:text-foreground">
                + New agent
              </NewAgentLink>
            </div>
          </div>
        </header>

        <Suspense fallback={<RunResultSkeleton />}>
          <DashboardCockpit
            timeZone={display.timeZone}
            userId={session.user.id}
          />
        </Suspense>
      </div>
    </AiGatewayKeyGateProvider>
  )
}
async function DashboardCockpit({
  timeZone,
  userId,
}: {
  timeZone: string
  userId: string
}) {
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
        <NewAgentLink className="mt-8 inline-flex h-14 items-center justify-center border-2 border-foreground bg-foreground px-6 font-bold text-background text-xs uppercase tracking-[0.16em] transition-colors hover:border-accent hover:bg-accent hover:text-foreground">
          Create agent
        </NewAgentLink>
      </div>
    )
  }

  const enabledCount = agents.filter((agent) => agent.enabled).length
  const pausedCount = agents.length - enabledCount
  const attentionAgents = agents.filter((agent) => !agent.enabled)
  const monitorAgents = agents.filter((agent) => agent.enabled)
  const [agentBudgets, agentEvents] = await Promise.all([
    Promise.all(
      monitorAgents.map(async (a) => ({
        agentId: a.id,
        entries: await loadBudgetSummary({
          userId,
          scope: { type: 'agent', agentId: a.id },
        }),
      }))
    ),
    Promise.all(
      monitorAgents.map(async (a) => ({
        agentId: a.id,
        events: await listAgentEventSummaries({
          agentId: a.id,
          limit: 25,
        }),
      }))
    ),
  ])
  const agentBudgetMap = new Map<string, BudgetSummaryEntry[]>(
    agentBudgets.map((b) => [b.agentId, b.entries])
  )
  const agentEventMap = new Map(
    agentEvents.map((entry) => [entry.agentId, entry.events])
  )
  const activeEventCount = agentEvents
    .flatMap((entry) => entry.events)
    .filter(isActiveDashboardEvent).length
  const attentionAgentIds = new Set<string>()
  for (const agent of attentionAgents) {
    attentionAgentIds.add(agent.id)
  }
  for (const entry of agentEvents) {
    if (entry.events.some(isFailedDashboardEvent)) {
      attentionAgentIds.add(entry.agentId)
    }
  }
  for (const entry of agentBudgets) {
    if (entry.entries.some(isBudgetAttention)) {
      attentionAgentIds.add(entry.agentId)
    }
  }

  return (
    <section aria-labelledby="dashboard-cockpit-heading">
      <h2 className="sr-only" id="dashboard-cockpit-heading">
        Operational cockpit
      </h2>

      <div className="mb-8 grid gap-4 border-foreground border-y-2 py-5 sm:grid-cols-3">
        <DashboardMetric label="Active" value={enabledCount} />
        <DashboardMetric label="In flight" value={activeEventCount} />
        <DashboardMetric label="Attention" value={attentionAgentIds.size} />
      </div>

      <div className="mb-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="border-foreground border-b-2 pb-6">
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

        <div className="border-foreground border-l-2 pl-4">
          <p className="font-bold text-[10px] uppercase tracking-[0.2em]">
            Quick actions
          </p>
          <div className="mt-4 grid gap-2">
            <QuickActionLink href="/agents/new" label="New agent" />
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

      <AttentionQueue agents={attentionAgents} />

      <section className="mt-12">
        <div className="mb-5 flex flex-wrap items-baseline justify-between gap-4">
          <div>
            <p className="swiss-label text-accent">Run monitor</p>
            <h2 className="mt-3 font-black font-serif text-3xl uppercase leading-none tracking-tighter">
              Event-ready agents
            </h2>
          </div>
          <Link
            className="font-bold text-muted-foreground text-xs uppercase tracking-[0.18em] hover:text-foreground"
            href="/agents"
          >
            Open registry →
          </Link>
        </div>
        {monitorAgents.length === 0 ? (
          <p className="border-foreground border-y-2 py-6 text-muted-foreground text-sm">
            No active agents yet.
          </p>
        ) : (
          <ul className="border-foreground border-y-2">
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

function AttentionQueue({ agents }: { agents: Agent[] }) {
  if (agents.length === 0) {
    return (
      <section className="border-foreground border-y-2 py-6">
        <p className="swiss-label text-accent">Paused agents</p>
        <p className="mt-3 text-muted-foreground text-sm">
          No paused agents right now.
        </p>
      </section>
    )
  }

  return (
    <section className="border-foreground border-y-2 py-6">
      <p className="swiss-label text-accent">Paused agents</p>
      <ul className="mt-5 grid gap-3 md:grid-cols-2">
        {agents.map((agent) => (
          <li key={agent.id}>
            <Link
              className="block border-2 border-foreground p-4 transition-colors hover:bg-accent"
              href={`/agents/${agent.id}`}
            >
              <p className="font-black font-serif text-xl uppercase leading-none tracking-tighter">
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

function QuickAction({ href, label }: { href: string; label: string }) {
  if (href === '/agents/new') {
    return <QuickActionLink href={href} label={label} />
  }
  return (
    <Link
      className="inline-flex h-10 items-center justify-center border-2 border-foreground px-3 font-bold text-[10px] uppercase tracking-[0.16em] transition-colors hover:bg-foreground hover:text-background"
      href={href}
    >
      {label}
    </Link>
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
      <header className="mb-12 border-foreground border-t-4 pt-6 md:mb-16">
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
