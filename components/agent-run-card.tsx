import Link from "next/link"
import type { Agent, Run, DigestItem, Category } from "@/lib/db/schema"
import { TriggerButton } from "@/components/trigger-button"
import { RunStatus } from "@/components/run-status"
import { RunProgress } from "@/components/run-progress"
import { DigestView } from "@/components/digest-view"
import { CATEGORY_META, CATEGORY_ORDER } from "@/lib/categories"
import { formatRelative } from "@/lib/format"

function formatDays(days: number[]): string {
  if (days.length === 7) return "Every day"
  const weekdays = [1, 2, 3, 4, 5]
  if (
    weekdays.every((d) => days.includes(d)) &&
    days.length === 5
  )
    return "Weekdays"
  const names = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
  return days
    .slice()
    .sort((a, b) => a - b)
    .map((d) => names[d] ?? "")
    .filter(Boolean)
    .join(" · ")
}

export function AgentRunCard({
  agent,
  kindLabel,
  latestRun,
  digestItems,
  digestSummary,
}: {
  agent: Agent
  kindLabel: string
  latestRun: Run | null
  digestItems: DigestItem[] | null
  digestSummary: string | null
}) {
  return (
    <article className="flex flex-col gap-6 py-10 first:pt-0 last:pb-0">
      <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex flex-col gap-1.5">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
            {kindLabel}
            {!agent.enabled && (
              <span className="ml-3 rounded-sm border border-border px-1.5 py-0.5 text-[10px] tracking-wider">
                PAUSED
              </span>
            )}
          </p>
          <h2 className="font-serif text-3xl font-medium leading-tight tracking-tight text-balance">
            {agent.name}
          </h2>
          <p className="font-mono text-xs text-muted-foreground">
            {formatDays(agent.scheduleDays)} · {agent.scheduleTime}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm md:flex-nowrap md:justify-end">
          {latestRun && (
            <RunStatus
              runId={latestRun.id}
              initialStatus={
                latestRun.status as "running" | "completed" | "failed"
              }
            />
          )}
          <TriggerButton agentId={agent.id} variant="outline" />
          <Link
            href={`/agents/${agent.id}`}
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Details →
          </Link>
        </div>
      </header>

      {latestRun?.status === "running" || latestRun?.status === "scheduled" ? (
        <RunProgress key={latestRun.id} runId={latestRun.id} />
      ) : latestRun?.status === "completed" && digestItems && digestItems.length >= 0 ? (
        <DigestSummary
          latestRunAt={latestRun.startedAt}
          items={digestItems}
          summary={digestSummary}
        />
      ) : latestRun?.status === "failed" ? (
        <div className="border-l-2 border-destructive pl-4">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-destructive">
            Last run failed
          </p>
          {latestRun.error && (
            <pre className="mt-2 max-h-32 overflow-auto rounded-md border border-border bg-muted/40 p-3 font-mono text-xs text-muted-foreground">
              {latestRun.error}
            </pre>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          No runs yet. Trigger one manually or wait for the next scheduled slot.
        </p>
      )}
    </article>
  )
}

function DigestSummary({
  latestRunAt,
  items,
  summary,
}: {
  latestRunAt: Date
  items: DigestItem[]
  summary: string | null
}) {
  const counts = CATEGORY_ORDER.map((c) => ({
    c,
    n: items.filter((i) => i.category === (c as Category)).length,
  }))
  const total = items.length

  return (
    <div className="flex flex-col gap-8">
      <section className="grid grid-cols-1 gap-10 border-y border-border py-6 md:grid-cols-[auto_1fr] md:gap-16">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
            New since last run
          </p>
          <p className="mt-2 font-serif text-5xl font-medium leading-none tabular-nums">
            {total}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            {formatRelative(latestRunAt)}
          </p>
        </div>
        <dl className="grid grid-cols-2 gap-x-10 gap-y-4 self-end sm:grid-cols-4">
          {counts.map(({ c, n }) => {
            const meta = CATEGORY_META[c as Category]
            return (
              <div key={c} className="flex flex-col gap-1">
                <dt
                  className={`font-mono text-xs uppercase tracking-wider ${meta.tone}`}
                >
                  {meta.shortLabel}
                </dt>
                <dd className="font-serif text-2xl font-medium tabular-nums">
                  {n.toString().padStart(2, "0")}
                </dd>
              </div>
            )
          })}
        </dl>
      </section>
      <DigestView items={items} summary={summary} />
    </div>
  )
}
