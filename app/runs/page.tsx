import Link from 'next/link'
import { Suspense } from 'react'
import { AppShell } from '@/components/app-shell'
import { RunStatus } from '@/components/run-status'
import { RunListSkeleton } from '@/components/skeletons'
import { requireSession } from '@/lib/auth-guard'
import { getCachedAllRuns } from '@/lib/data'
import { formatDateTime } from '@/lib/format'
import { toRunLifecycleStatus } from '@/lib/run-lifecycle'

export default function RunsPage() {
  return (
    <AppShell>
      <header className="mb-12 border-foreground border-t-4 pt-6">
        <div className="grid gap-8 md:grid-cols-[minmax(0,7fr)_minmax(14rem,3fr)] md:items-end">
          <div>
            <p className="swiss-label mb-4 text-accent">07. History</p>
            <h1 className="font-black font-serif text-6xl uppercase leading-[0.9] tracking-tighter md:text-8xl">
              All runs
            </h1>
          </div>
          <Link
            className="inline-flex h-14 shrink-0 items-center justify-center self-start border-2 border-foreground px-6 font-bold text-xs uppercase tracking-[0.16em] transition-colors hover:bg-foreground hover:text-background md:self-auto"
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
      <div className="swiss-dots border-2 border-foreground bg-muted p-8 md:p-12">
        <p className="font-black font-serif text-3xl uppercase leading-none tracking-tighter">
          No runs yet.
        </p>
        <p className="mt-3 text-muted-foreground text-sm">
          Trigger your first inbox review to see it here.
        </p>
      </div>
    )
  }

  return (
    <ul className="border-foreground border-y-2">
      {runs.map((run) => (
        <li key={run.id}>
          <Link
            className="group grid grid-cols-[1fr_auto] items-baseline gap-6 border-foreground border-b-2 py-5 transition-colors last:border-b-0 hover:bg-accent md:grid-cols-[1fr_auto_auto] md:gap-10 md:px-4"
            href={`/runs/${run.id}`}
          >
            <div className="flex min-w-0 flex-col gap-1.5">
              <span className="font-black font-serif text-lg uppercase leading-tight tracking-[-0.04em]">
                {formatDateTime(run.startedAt)}
              </span>
              <span className="font-mono text-muted-foreground text-xs uppercase tracking-wider">
                {run.id}
              </span>
            </div>
            <RunStatus
              initialStatus={toRunLifecycleStatus(run.status)}
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
