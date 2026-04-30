import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { RunProgress } from '@/components/run-progress'
import { RunResultView } from '@/components/run-result-view'
import { RunStatus } from '@/components/run-status'
import { TriggerButton } from '@/components/trigger-button'
import { requireSession } from '@/lib/auth-guard'
import {
  getCachedAgentByIdForUser,
  getCachedLatestRunForAgent,
  getCachedRunResult,
  getCachedRunsForAgent,
} from '@/lib/data'
import type { Agent, Run } from '@/lib/db/schema'
import { formatDateTime, formatRelative } from '@/lib/format'

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

  return (
    <>
      <AgentOverviewHeader agent={agent} />

      <section>
        <Suspense fallback={<LastRunSkeleton />}>
          <LastRunSection agentId={agent.id} />
        </Suspense>
      </section>

      <section className="py-12">
        <h2 className="swiss-label mb-6 text-accent">06. History</h2>
        <Suspense fallback={<HistorySkeleton />}>
          <AgentHistorySection agentId={agent.id} />
        </Suspense>
      </section>
    </>
  )
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
          </p>
          <h1 className="font-black font-serif text-5xl uppercase leading-[0.9] tracking-tighter md:text-7xl">
            {agent.name}
          </h1>
        </div>
        <div className="flex flex-wrap items-start gap-3 border-foreground border-l-2 pl-4 md:justify-end">
          <TriggerButton agentId={agent.id} />
          <Link
            className="inline-flex h-10 items-center justify-center border-2 border-foreground px-4 font-bold text-xs uppercase tracking-[0.16em] transition-colors hover:bg-foreground hover:text-background"
            href={`/agents/${agent.id}/edit`}
          >
            Configure
          </Link>
          <Link
            className="inline-flex h-10 items-center justify-center border-2 border-foreground px-4 font-bold text-xs uppercase tracking-[0.16em] transition-colors hover:bg-foreground hover:text-background"
            href={`/agents/${agent.id}/tools`}
          >
            Tools
          </Link>
          <Link
            className="inline-flex h-10 items-center justify-center border-2 border-foreground px-4 font-bold text-xs uppercase tracking-[0.16em] transition-colors hover:bg-foreground hover:text-background"
            href={`/agents/${agent.id}/files`}
          >
            Files
          </Link>
        </div>
      </div>
    </header>
  )
}

async function LastRunSection({ agentId }: { agentId: string }) {
  const latest = await getCachedLatestRunForAgent(agentId)
  return (
    <>
      <div className="mb-8 flex items-baseline justify-between gap-4 border-foreground border-t-2 pt-6">
        <h2 className="swiss-label text-accent">05. Last run</h2>
        {latest && (
          <Link
            className="font-bold text-muted-foreground text-xs uppercase tracking-wider transition-colors hover:text-accent"
            href={`/runs/${latest.id}`}
          >
            Open run →
          </Link>
        )}
      </div>
      <LastRunBody latest={latest} />
    </>
  )
}

async function LastRunBody({ latest }: { latest: Run | null }) {
  if (!latest) {
    return (
      <p className="text-muted-foreground text-sm">
        No runs yet. Trigger one manually to see results here.
      </p>
    )
  }

  if (latest.status === 'running') {
    return <RunProgress key={latest.id} runId={latest.id} />
  }

  if (latest.status === 'failed') {
    return (
      <div className="flex flex-col gap-3">
        <p className="inline-flex items-center gap-3 text-sm">
          <span aria-hidden className="inline-block size-2 bg-destructive" />
          <span className="text-destructive">Run failed</span>
          <span className="text-muted-foreground">
            · {formatDateTime(latest.startedAt)}
          </span>
        </p>
        {latest.error && (
          <pre className="max-h-64 overflow-auto border-2 border-border bg-muted p-4 font-mono text-muted-foreground text-xs">
            {latest.error}
          </pre>
        )}
      </div>
    )
  }

  const result = await getCachedRunResult(latest.id)
  return (
    <div className="flex flex-col gap-6">
      <p className="font-mono text-muted-foreground text-xs">
        {formatDateTime(latest.startedAt)}
      </p>
      <RunResultView content={result?.content ?? null} />
    </div>
  )
}

async function AgentHistorySection({ agentId }: { agentId: string }) {
  const runs = await getCachedRunsForAgent(agentId, 20)

  if (runs.length === 0) {
    return <p className="text-muted-foreground text-sm">No runs yet.</p>
  }

  return (
    <ul className="border-foreground border-y-2">
      {runs.map((r) => (
        <li key={r.id}>
          <Link
            className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-1 border-foreground border-b-2 py-4 transition-colors last:border-b-0 hover:bg-accent sm:grid-cols-[auto_1fr_auto] sm:gap-8 sm:px-3"
            href={`/runs/${r.id}`}
          >
            <RunStatus
              initialStatus={r.status as 'running' | 'completed' | 'failed'}
              runId={r.id}
              showTime={false}
            />
            <span className="min-w-0 truncate font-mono text-muted-foreground text-xs">
              {r.id}
            </span>
            <span className="col-start-2 font-mono text-muted-foreground text-xs sm:col-auto sm:text-right">
              {formatRelative(r.startedAt)}
            </span>
          </Link>
        </li>
      ))}
    </ul>
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

function LastRunSkeleton() {
  return (
    <>
      <div className="mb-8 flex items-baseline justify-between gap-4">
        <div className="h-3 w-16 animate-pulse rounded-sm bg-muted" />
        <div className="h-3 w-20 animate-pulse rounded-sm bg-muted" />
      </div>
      <div className="flex flex-col gap-3">
        <div className="h-4 w-36 animate-pulse rounded-sm bg-muted" />
        <div className="h-24 w-full animate-pulse rounded-sm bg-muted" />
      </div>
    </>
  )
}

function HistorySkeleton() {
  return (
    <div className="flex flex-col gap-3 border-border border-y py-3">
      {[0, 1, 2].map((index) => (
        <div
          className="grid grid-cols-[auto_1fr_auto] items-center gap-4 px-2 py-3"
          key={index}
        >
          <div className="h-4 w-20 animate-pulse rounded-sm bg-muted" />
          <div className="h-3 w-32 animate-pulse rounded-sm bg-muted" />
          <div className="h-3 w-20 animate-pulse rounded-sm bg-muted" />
        </div>
      ))}
    </div>
  )
}
