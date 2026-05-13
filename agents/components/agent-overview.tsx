import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { formatAgentCadence } from '@/agents/format'
import { requireSession } from '@/auth/server/auth-guard'
import { BudgetIndicator } from '@/budgets/components/budget-indicator'
import { loadBudgetSummary } from '@/budgets/server/summary'
import {
  getCachedAgentByIdForUser,
  getCachedAgentLogFiles,
  getCachedAgentMemoryFile,
  getCachedAgentTools,
} from '@/shared/server/data'
import { formatNullableAgentDate } from './agent-format'

type Params = Promise<{ agentId: string }>

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

  const [budgetEntries, tools, logs, dreams] = await Promise.all([
    loadBudgetSummary({
      userId: session.user.id,
      scope: { type: 'agent', agentId: agent.id },
    }),
    getCachedAgentTools(agent.id),
    getCachedAgentLogFiles(agent.id),
    getCachedAgentMemoryFile({ agentId: agent.id, path: 'DREAMS.md' }),
  ])

  const connectedTools = tools.filter((tool) => tool.status === 'connected')
  const pendingTools = tools.filter((tool) => tool.status === 'pending')

  return (
    <>
      <section aria-labelledby="agent-overview-heading">
        <h2 className="sr-only" id="agent-overview-heading">
          Agent overview
        </h2>
        <div className="grid gap-6 md:grid-cols-2">
          <OverviewPanel
            actionHref={`/agents/${agent.id}/configure#runtime`}
            actionLabel="Edit runtime"
            title="Runtime"
          >
            <OverviewList
              items={[
                { label: 'Model', value: agent.model },
                {
                  label: 'Heartbeat',
                  value: agent.heartbeatEnabled
                    ? formatAgentCadence(agent.heartbeatIntervalMinutes)
                    : 'Off',
                },
                {
                  label: 'Last heartbeat',
                  value: formatNullableAgentDate(agent.lastHeartbeatAt),
                },
                {
                  label: 'Dreaming',
                  value: agent.dreamingEnabled
                    ? formatAgentCadence(agent.dreamingIntervalMinutes)
                    : 'Off',
                },
                {
                  label: 'Last dream',
                  value: formatNullableAgentDate(agent.lastDreamingAt),
                },
              ]}
            />
          </OverviewPanel>

          <OverviewPanel
            actionHref={`/agents/${agent.id}/tools`}
            actionLabel="Manage tools"
            title="Tools"
          >
            <OverviewList
              items={[
                {
                  label: 'Connected',
                  value: connectedTools.length.toString(),
                },
                { label: 'Pending', value: pendingTools.length.toString() },
                {
                  label: 'Total attached',
                  value: tools.length.toString(),
                },
              ]}
            />
          </OverviewPanel>

          <OverviewPanel
            actionHref={`/agents/${agent.id}/memory`}
            actionLabel="Open memory"
            title="Memory"
          >
            <OverviewList
              items={[
                { label: 'Daily logs', value: logs.length.toString() },
                {
                  label: 'DREAMS.md',
                  value: dreams ? 'Present' : 'Missing',
                },
                {
                  label: 'Latest log',
                  value: logs[0]
                    ? formatNullableAgentDate(logs[0].updatedAt)
                    : 'Never',
                },
              ]}
            />
          </OverviewPanel>

          <OverviewPanel
            actionHref={`/agents/${agent.id}/configure#budget`}
            actionLabel="Edit budget"
            title="Budget"
          >
            <BudgetIndicator
              emptyHref={`/agents/${agent.id}/configure#budget`}
              emptyLabel="No agent budget set · configure →"
              entries={budgetEntries}
              variant="agent"
            />
          </OverviewPanel>
        </div>
      </section>

      <section className="mt-12 border-foreground border-t-2 pt-8">
        <div className="mb-6 flex flex-wrap items-baseline justify-between gap-4">
          <div>
            <p className="swiss-label text-accent">Activity</p>
            <h2 className="mt-3 font-black font-serif text-3xl uppercase leading-none tracking-tighter">
              Current state
            </h2>
          </div>
          <Link
            className="font-bold text-muted-foreground text-xs uppercase tracking-[0.18em] hover:text-foreground"
            href={`/agents/${agent.id}/chat`}
          >
            Open chat →
          </Link>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <StateTile
            label="Agent"
            value={agent.enabled ? 'Active' : 'Paused'}
          />
          <StateTile
            label="Session"
            value={agent.lastSessionRunId ? 'Ready' : 'Not started'}
          />
          <StateTile
            label="Recovery"
            value={
              agent.lastRecoveryAt
                ? formatNullableAgentDate(agent.lastRecoveryAt)
                : 'No recovery yet'
            }
          />
        </div>
      </section>
    </>
  )
}

function OverviewPanel({
  actionHref,
  actionLabel,
  children,
  title,
}: {
  actionHref: string
  actionLabel: string
  children: React.ReactNode
  title: string
}) {
  return (
    <section className="border-2 border-foreground bg-background p-5">
      <div className="mb-5 flex items-center justify-between gap-4">
        <h3 className="font-bold text-xs uppercase tracking-[0.18em]">
          {title}
        </h3>
        <Link
          className="font-bold text-[10px] text-muted-foreground uppercase tracking-[0.16em] hover:text-foreground"
          href={actionHref}
        >
          {actionLabel} →
        </Link>
      </div>
      {children}
    </section>
  )
}

function OverviewList({
  items,
}: {
  items: Array<{ label: string; value: string }>
}) {
  return (
    <dl className="grid gap-4">
      {items.map((item) => (
        <div key={item.label}>
          <dt className="text-muted-foreground text-xs uppercase tracking-[0.16em]">
            {item.label}
          </dt>
          <dd className="mt-1 font-medium text-sm">{item.value}</dd>
        </div>
      ))}
    </dl>
  )
}

function StateTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-foreground border-l-2 pl-4">
      <p className="font-bold text-[10px] text-muted-foreground uppercase tracking-[0.2em]">
        {label}
      </p>
      <p className="mt-2 font-black font-serif text-2xl uppercase leading-none tracking-tighter">
        {value}
      </p>
    </div>
  )
}

function OverviewSkeleton() {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      {[0, 1, 2, 3].map((index) => (
        <div
          className="h-48 animate-pulse border-2 border-foreground bg-muted"
          key={index}
        />
      ))}
    </div>
  )
}
