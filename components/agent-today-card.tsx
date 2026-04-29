import Link from 'next/link'
import { AgentLiveStatus } from '@/components/agent-live-status'
import type { Agent, Run } from '@/lib/db/schema'
import { formatRelative } from '@/lib/format'

/**
 * Compact, clickable card shown on the Today screen.
 *
 * The entire card is a Link to `/agents/[id]`. The body shows a live
 * streaming message when a run is in progress, a simple status line on
 * completion, a failure banner on error, or an empty state. The card
 * is deliberately small and uniform so the user can scan all agents at
 * a glance.
 */
export function AgentTodayCard({
  agent,
  latestRun,
}: {
  agent: Agent
  latestRun: Run | null
}) {
  return (
    <Link
      className="group grid gap-6 border-foreground border-b-2 py-8 transition-colors last:border-b-0 hover:bg-accent md:grid-cols-[minmax(0,7fr)_minmax(14rem,3fr)] md:px-4"
      href={`/agents/${agent.id}`}
    >
      <div className="flex flex-col gap-1.5">
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 font-bold text-[10px] text-muted-foreground uppercase tracking-[0.2em] group-hover:text-foreground">
          <span>{agent.model}</span>
          {!agent.enabled && (
            <span className="border border-border px-1.5 py-0.5 text-[10px] tracking-wider">
              PAUSED
            </span>
          )}
        </p>
        <h2 className="text-pretty font-black font-serif text-4xl uppercase leading-[0.95] tracking-tighter md:text-5xl">
          {agent.name}
        </h2>
      </div>

      <div className="flex items-end justify-between gap-6 border-foreground border-t-2 pt-5 md:border-t-0 md:border-l-2 md:pl-6">
        <div className="min-w-0 flex-1">
          <CardStatus latestRun={latestRun} />
        </div>
        <span
          aria-hidden
          className="shrink-0 font-bold text-muted-foreground text-sm transition-transform group-hover:translate-x-1 group-hover:text-foreground"
        >
          Open →
        </span>
      </div>
    </Link>
  )
}

function CardStatus({ latestRun }: { latestRun: Run | null }) {
  if (!latestRun) {
    return (
      <p className="text-muted-foreground text-sm">
        No runs yet — trigger one from the agent page.
      </p>
    )
  }

  if (latestRun.status === 'running') {
    return <AgentLiveStatus runId={latestRun.id} />
  }

  if (latestRun.status === 'failed') {
    return (
      <div className="flex flex-col gap-1">
        <span className="inline-flex items-center gap-2 text-destructive text-sm">
          <span aria-hidden className="inline-block size-2 bg-destructive" />
          Last run failed
          <span className="text-muted-foreground">
            · {formatRelative(latestRun.startedAt)}
          </span>
        </span>
        {latestRun.error && (
          <span className="truncate font-mono text-muted-foreground text-xs">
            {latestRun.error}
          </span>
        )}
      </div>
    )
  }

  // completed — agent-agnostic status line
  return (
    <span className="inline-flex items-center gap-2 text-sm">
      <span aria-hidden className="inline-block size-2 bg-foreground" />
      <span className="text-foreground">Last run complete</span>
      <span className="text-muted-foreground">
        · {formatRelative(latestRun.startedAt)}
      </span>
    </span>
  )
}
