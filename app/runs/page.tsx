import { Suspense } from "react"
import Link from "next/link"
import { requireSession } from "@/lib/auth-guard"
import { getCachedAllRuns } from "@/lib/data"
import { AppShell } from "@/components/app-shell"
import { RunStatus } from "@/components/run-status"
import { formatDateTime } from "@/lib/format"
import { RunListSkeleton } from "@/components/skeletons"

export default function RunsPage() {
  return (
    <AppShell>
      <header className="mb-10 flex flex-col gap-2 md:mb-14">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
          History
        </p>
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <h1 className="font-serif text-4xl font-medium leading-tight tracking-tight md:text-5xl">
            All runs
          </h1>
          <Link
            href="/agents"
            className="inline-flex shrink-0 items-center justify-center self-start rounded-md border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted md:self-auto"
          >
            Manage agents →
          </Link>
        </div>
      </header>

      <Suspense fallback={<RunListSkeleton />}>
        <RunList />
      </Suspense>
    </AppShell>
  )
}

async function RunList() {
  await requireSession()
  const runs = await getCachedAllRuns()

  if (runs.length === 0) {
    return (
      <div className="border-t border-border pt-10">
        <p className="font-serif text-2xl leading-snug">No runs yet.</p>
        <p className="mt-3 text-sm text-muted-foreground">
          Trigger your first inbox review to see it here.
        </p>
      </div>
    )
  }

  return (
    <ul className="flex flex-col divide-y divide-border border-y border-border">
      {runs.map((run) => (
        <li key={run.id}>
          <Link
            href={`/runs/${run.id}`}
            className="group grid grid-cols-[1fr_auto] items-baseline gap-6 py-5 md:grid-cols-[1fr_auto_auto] md:gap-10"
          >
            <div className="flex flex-col gap-1.5 min-w-0">
              <span className="font-serif text-lg font-medium leading-tight transition-colors group-hover:text-foreground/70">
                {formatDateTime(run.startedAt)}
              </span>
              <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                {run.trigger} · {run.emailsScanned} email{run.emailsScanned === 1 ? "" : "s"}
              </span>
            </div>
            <RunStatus runId={run.id} initialStatus={run.status as any} showTime={false} />
            <span
              aria-hidden
              className="hidden text-muted-foreground transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-1 group-hover:text-foreground md:inline-block"
            >
              →
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
