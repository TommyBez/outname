import Link from 'next/link'
import { Suspense } from 'react'
import { AppShell } from '@/components/app-shell'
import { RunStatus } from '@/components/run-status'
import { RunListSkeleton } from '@/components/skeletons'
import { requireSession } from '@/lib/auth-guard'
import { getCachedAllRuns } from '@/lib/data'
import { formatDateTime } from '@/lib/format'

export default function RunsPage() {
  return (
    <AppShell>
      <header className="mb-10 flex flex-col gap-2 md:mb-14">
        <p className="font-mono text-muted-foreground text-xs uppercase tracking-[0.2em]">
          History
        </p>
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <h1 className="font-medium font-serif text-4xl leading-tight tracking-tight md:text-5xl">
            All runs
          </h1>
          <Link
            className="inline-flex shrink-0 items-center justify-center self-start rounded-md border border-border px-4 py-2 font-medium text-sm transition-colors hover:bg-muted md:self-auto"
            href="/agents"
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
      <div className="border-border border-t pt-10">
        <p className="font-serif text-2xl leading-snug">No runs yet.</p>
        <p className="mt-3 text-muted-foreground text-sm">
          Trigger your first inbox review to see it here.
        </p>
      </div>
    )
  }

  return (
    <ul className="flex flex-col divide-y divide-border border-border border-y">
      {runs.map((run) => (
        <li key={run.id}>
          <Link
            className="group grid grid-cols-[1fr_auto] items-baseline gap-6 py-5 md:grid-cols-[1fr_auto_auto] md:gap-10"
            href={`/runs/${run.id}`}
          >
            <div className="flex min-w-0 flex-col gap-1.5">
              <span className="font-medium font-serif text-lg leading-tight transition-colors group-hover:text-foreground/70">
                {formatDateTime(run.startedAt)}
              </span>
              <span className="font-mono text-muted-foreground text-xs uppercase tracking-wider">
                {run.id}
              </span>
            </div>
            <RunStatus
              initialStatus={run.status as any}
              runId={run.id}
              showTime={false}
            />
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
