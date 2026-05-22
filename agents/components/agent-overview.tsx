import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { listRecentAgentEvents } from '@/agent-runtime/server/agent-event-store'
import { formatAgentSchedule } from '@/agents/format'
import { requireSession } from '@/auth/server/auth-guard'
import { BudgetIndicator } from '@/budgets/components/budget-indicator'
import { loadBudgetSummary } from '@/budgets/server/summary'
import {
  getCachedAgentByIdForUser,
  getCachedAgentLogFiles,
  getCachedAgentMemoryFile,
  getCachedAgentTools,
} from '@/shared/server/data'
import { getUserTimezone } from '@/shared/server/user-timezone'
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

  const [budgetEntries, tools, logs, dreams, recentEvents, timeZone] =
    await Promise.all([
      loadBudgetSummary({
        userId: session.user.id,
        scope: { type: 'agent', agentId: agent.id },
      }),
      getCachedAgentTools(agent.id),
      getCachedAgentLogFiles(agent.id),
      getCachedAgentMemoryFile({ agentId: agent.id, path: 'DREAMS.md' }),
      listRecentAgentEvents({ agentId: agent.id, limit: 6 }),
      getUserTimezone(session.user.id),
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
                  value: formatAgentSchedule({
                    enabled: agent.heartbeatEnabled,
                    intervalMinutes: agent.heartbeatIntervalMinutes,
                    mode: agent.heartbeatScheduleMode,
                    timeZone,
                    times: agent.heartbeatScheduleTimes,
                  }),
                },
                {
                  label: 'Last heartbeat',
                  value: formatNullableAgentDate(
                    agent.lastHeartbeatAt,
                    timeZone
                  ),
                },
                {
                  label: 'Dreaming',
                  value: agent.dreamingEnabled ? 'Daily' : 'Off',
                },
                {
                  label: 'Last dream',
                  value: formatNullableAgentDate(
                    agent.lastDreamingAt,
                    timeZone
                  ),
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
                    ? formatNullableAgentDate(logs[0].updatedAt, timeZone)
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
            label="Runtime"
            value={agent.enabled ? 'Event-ready' : 'Paused'}
          />
          <StateTile
            label="Scheduling"
            value={agent.heartbeatEnabled ? 'Heartbeat on' : 'Heartbeat off'}
          />
        </div>
      </section>

      <section className="mt-12 border-foreground border-t-2 pt-8">
        <div className="mb-6 flex flex-wrap items-baseline justify-between gap-4">
          <div>
            <p className="swiss-label text-accent">Events</p>
            <h2 className="mt-3 font-black font-serif text-3xl uppercase leading-none tracking-tighter">
              Recent event ledger
            </h2>
          </div>
          <Link
            className="font-bold text-muted-foreground text-xs uppercase tracking-[0.18em] hover:text-foreground"
            href={`/agents/${agent.id}/events`}
          >
            Open events →
          </Link>
        </div>
        {recentEvents.length === 0 ? (
          <p className="border-foreground border-y-2 py-6 text-muted-foreground text-sm">
            No events recorded yet.
          </p>
        ) : (
          <ul className="border-foreground border-y-2">
            {recentEvents.map((event) => (
              <li
                className="border-foreground border-b-2 last:border-b-0"
                key={event.id}
              >
                <Link
                  className="grid gap-2 py-4 transition-colors hover:bg-accent md:grid-cols-[10rem_1fr_10rem]"
                  href={`/agents/${agent.id}/events?event=${event.id}`}
                >
                  <span className="font-bold text-xs uppercase tracking-[0.16em]">
                    {event.status}
                  </span>
                  <span className="text-sm">
                    {event.type} · {event.source}
                  </span>
                  <span className="font-mono text-muted-foreground text-xs md:text-right">
                    {formatNullableAgentDate(event.queuedAt, timeZone)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
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
