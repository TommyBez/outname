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
      className="group flex flex-col gap-5 py-10 transition-colors first:pt-0 last:pb-0 hover:bg-muted/30 md:px-2"
      href={`/agents/${agent.id}`}
    >
      <div className="flex flex-col gap-1.5">
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-muted-foreground text-xs uppercase tracking-[0.2em]">
          <span>{agent.model}</span>
          {!agent.enabled && (
            <span className="rounded-sm border border-border px-1.5 py-0.5 text-[10px] tracking-wider">
              PAUSED
            </span>
          )}
        </p>
        <h2 className="text-pretty font-medium font-serif text-3xl leading-tight tracking-tight">
          {agent.name}
        </h2>
      </div>

      <div className="flex items-center justify-between gap-6 border-border border-t pt-5">
        <div className="min-w-0 flex-1">
          <CardStatus latestRun={latestRun} />
        </div>
        <span
          aria-hidden
          className="shrink-0 text-muted-foreground text-sm transition-colors group-hover:text-foreground"
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
          <span
            aria-hidden
            className="inline-block size-1.5 rounded-full bg-destructive"
          />
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
      <span
        aria-hidden
        className="inline-block size-1.5 rounded-full bg-foreground/50"
      />
      <span className="text-foreground">Last run complete</span>
      <span className="text-muted-foreground">
        · {formatRelative(latestRun.startedAt)}
      </span>
    </span>
  )
}
