import Link from "next/link"
import type { Agent, Run, DigestItem, Category } from "@/lib/db/schema"
import { AgentLiveStatus } from "@/components/agent-live-status"
import { CATEGORY_META } from "@/lib/categories"
import { formatRelative } from "@/lib/format"

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

/**
 * Compact, clickable card shown on the Today screen.
 *
 * The entire card is a Link to `/agents/[id]`. The body shows a live
 * streaming message when a run is in progress, a tiny count breakdown on
 * completion, a failure banner on error, or an empty state.
 *
 * Full digest rendering lives on the agent detail page — this card is
 * deliberately small so the user can scan all agents at a glance.
 */
export function AgentTodayCard({
  agent,
  kindLabel,
  latestRun,
  digestItems,
}: {
  agent: Agent
  kindLabel: string
  latestRun: Run | null
  digestItems: DigestItem[] | null
}) {
  return (
    <Link
      href={`/agents/${agent.id}`}
      className="group flex flex-col gap-5 py-10 transition-colors first:pt-0 last:pb-0 hover:bg-muted/30 md:px-2"
    >
      <div className="flex flex-col gap-1.5">
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
          <span>{kindLabel}</span>
          {!agent.enabled && (
            <span className="rounded-sm border border-border px-1.5 py-0.5 text-[10px] tracking-wider">
              PAUSED
            </span>
          )}
        </p>
        <h2 className="font-serif text-3xl font-medium leading-tight tracking-tight text-pretty">
          {agent.name}
        </h2>
        <p className="font-mono text-xs text-muted-foreground">
          {formatDays(agent.scheduleDays)} · {agent.scheduleTime}
        </p>
      </div>

      <div className="flex items-center justify-between gap-6 border-t border-border pt-5">
        <div className="min-w-0 flex-1">
          <CardStatus
            latestRun={latestRun}
            digestItems={digestItems}
          />
        </div>
        <span
          aria-hidden
          className="shrink-0 text-sm text-muted-foreground transition-colors group-hover:text-foreground"
        >
          Open →
        </span>
      </div>
    </Link>
  )
}

function CardStatus({
  latestRun,
  digestItems,
}: {
  latestRun: Run | null
  digestItems: DigestItem[] | null
}) {
  if (!latestRun) {
    return (
      <p className="text-sm text-muted-foreground">
        No runs yet — trigger one from the agent page.
      </p>
    )
  }

  if (latestRun.status === "running" || latestRun.status === "scheduled") {
    return <AgentLiveStatus runId={latestRun.id} />
  }

  if (latestRun.status === "failed") {
    return (
      <div className="flex flex-col gap-1">
        <span className="inline-flex items-center gap-2 text-sm text-destructive">
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
          <span className="truncate font-mono text-xs text-muted-foreground">
            {latestRun.error}
          </span>
        )}
      </div>
    )
  }

  // completed
  const items = digestItems ?? []
  const counts = (["urgent", "reply", "fyi", "noise"] as Category[]).map((c) => ({
    c,
    n: items.filter((i) => i.category === c).length,
  }))

  return (
    <div className="flex flex-col gap-2">
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
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 font-mono text-xs text-muted-foreground">
        <span className="text-foreground">
          {items.length.toString().padStart(2, "0")} item
          {items.length === 1 ? "" : "s"}
        </span>
        {counts
          .filter((x) => x.n > 0)
          .map(({ c, n }) => (
            <span key={c} className={CATEGORY_META[c].tone}>
              {n} {CATEGORY_META[c].shortLabel}
            </span>
          ))}
      </div>
    </div>
  )
}
