import { Suspense } from "react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { requireSession } from "@/lib/auth-guard"
import {
  getCachedAgentByIdForUser,
  getCachedDigestWithItems,
  getCachedLatestRunForAgent,
  getCachedRunsForAgent,
} from "@/lib/data"
import { RunProgress } from "@/components/run-progress"
import { RunStatus } from "@/components/run-status"
import { DigestView } from "@/components/digest-view"
import { TriggerButton } from "@/components/trigger-button"
import { formatDateTime, formatRelative } from "@/lib/format"
import { AGENT_KINDS } from "@/workflows/agents/registry"
import type { Agent, AgentKind, Run } from "@/lib/db/schema"

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
  if (!agent) notFound()

  const meta = AGENT_KINDS[agent.kind as AgentKind]

  return (
    <>
      <AgentOverviewHeader
        agent={agent}
        kindLabel={meta?.label ?? agent.kind}
      />

      <section>
        <Suspense fallback={<LastRunSkeleton />}>
          <LastRunSection agentId={agent.id} />
        </Suspense>
      </section>

      <section className="py-10">
        <h2 className="mb-4 font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
          History
        </h2>
        <Suspense fallback={<HistorySkeleton />}>
          <AgentHistorySection agentId={agent.id} />
        </Suspense>
      </section>
    </>
  )
}

function AgentOverviewHeader({
  agent,
  kindLabel,
}: {
  agent: Agent
  kindLabel: string
}) {
  return (
    <header className="mb-10 flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
          <span>{kindLabel}</span>
          {!agent.enabled && (
            <span className="rounded-sm border border-border px-1.5 py-0.5 text-[10px] tracking-wider">
              PAUSED
            </span>
          )}
        </p>
        <h1 className="font-serif text-4xl font-medium leading-tight tracking-tight md:text-5xl">
          {agent.name}
        </h1>
        <p className="font-mono text-xs text-muted-foreground">
          {formatDays(agent.scheduleDays)} · {agent.scheduleTime}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <TriggerButton agentId={agent.id} />
        <Link
          href={`/agents/${agent.id}/edit`}
          className="inline-flex items-center justify-center rounded-md border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
        >
          Configure
        </Link>
      </div>
    </header>
  )
}

async function LastRunSection({ agentId }: { agentId: string }) {
  const latest = await getCachedLatestRunForAgent(agentId)
  return (
    <>
      <div className="mb-8 flex items-baseline justify-between gap-4">
        <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Last run
        </h2>
        {latest && (
          <Link
            href={`/runs/${latest.id}`}
            className="font-mono text-xs uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
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
      <p className="text-sm text-muted-foreground">
        No runs yet. Trigger one manually or wait for the next scheduled slot.
      </p>
    )
  }

  if (latest.status === "running" || latest.status === "scheduled") {
    return <RunProgress key={latest.id} runId={latest.id} />
  }

  if (latest.status === "failed") {
    return (
      <div className="flex flex-col gap-3">
        <p className="inline-flex items-center gap-3 text-sm">
          <span
            aria-hidden
            className="inline-block size-1.5 rounded-full bg-destructive"
          />
          <span className="text-destructive">Run failed</span>
          <span className="text-muted-foreground">
            · {formatDateTime(latest.startedAt)}
          </span>
        </p>
        {latest.error && (
          <pre className="max-h-64 overflow-auto rounded-md border border-border bg-muted/40 p-3 font-mono text-xs text-muted-foreground">
            {latest.error}
          </pre>
        )}
      </div>
    )
  }

  const { digest, items } = await getCachedDigestWithItems(latest.id)
  return (
    <div className="flex flex-col gap-6">
      <p className="font-mono text-xs text-muted-foreground">
        {formatDateTime(latest.startedAt)} · {latest.emailsScanned} email
        {latest.emailsScanned === 1 ? "" : "s"} scanned
      </p>
      <DigestView items={items} summary={digest?.summary ?? null} />
    </div>
  )
}

async function AgentHistorySection({ agentId }: { agentId: string }) {
  const runs = await getCachedRunsForAgent(agentId, 20)

  if (runs.length === 0) {
    return <p className="text-sm text-muted-foreground">No runs yet.</p>
  }

  return (
    <ul className="flex flex-col divide-y divide-border border-y border-border">
      {runs.map((r) => (
        <li key={r.id}>
          <Link
            href={`/runs/${r.id}`}
            className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-1 py-3 transition-colors hover:bg-muted/30 sm:grid-cols-[auto_1fr_auto] sm:gap-8 sm:px-2"
          >
            <RunStatus
              runId={r.id}
              initialStatus={r.status as "running" | "completed" | "failed"}
              showTime={false}
            />
            <span className="min-w-0 truncate font-mono text-xs text-muted-foreground">
              {r.id}
            </span>
            <span className="col-start-2 font-mono text-xs text-muted-foreground sm:col-auto sm:text-right">
              {formatRelative(r.startedAt)}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}

function formatDays(days: number[]): string {
  if (days.length === 7) return "Every day"
  const weekdays = [1, 2, 3, 4, 5]
  if (weekdays.every((d) => days.includes(d)) && days.length === 5) {
    return "Weekdays"
  }
  const names = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
  return days
    .slice()
    .sort((a, b) => a - b)
    .map((d) => names[d] ?? "")
    .filter(Boolean)
    .join(" · ")
}

function OverviewSkeleton() {
  return (
    <>
      <header className="mb-10 flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <div className="h-3 w-24 animate-pulse rounded-sm bg-muted" />
          <div className="h-10 w-64 animate-pulse rounded-sm bg-muted" />
          <div className="h-3 w-40 animate-pulse rounded-sm bg-muted" />
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
    <div className="flex flex-col gap-3 border-y border-border py-3">
      {[0, 1, 2].map((index) => (
        <div key={index} className="grid grid-cols-[auto_1fr_auto] items-center gap-4 px-2 py-3">
          <div className="h-4 w-20 animate-pulse rounded-sm bg-muted" />
          <div className="h-3 w-32 animate-pulse rounded-sm bg-muted" />
          <div className="h-3 w-20 animate-pulse rounded-sm bg-muted" />
        </div>
      ))}
    </div>
  )
}
