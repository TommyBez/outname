import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { AppShell } from '@/components/app-shell'
import { RunProgress } from '@/components/run-progress'
import { RunResultView } from '@/components/run-result-view'
import { RunStatus } from '@/components/run-status'
import { RunResultSkeleton } from '@/components/skeletons'
import { Skeleton } from '@/components/ui/skeleton'
import { requireSession } from '@/lib/auth-guard'
import {
  getCachedChildRunsForParent,
  getCachedRunById,
  getCachedRunResult,
} from '@/lib/data'
import { formatDateTime } from '@/lib/format'
import { toRunLifecycleStatus } from '@/lib/run-lifecycle'

export default function RunDetailPage({
  params,
}: {
  params: Promise<{ runId: string }>
}) {
  return (
    <AppShell>
      <Link
        className="mb-10 inline-block font-bold text-muted-foreground text-xs uppercase tracking-[0.18em] transition-colors hover:text-accent"
        href="/runs"
      >
        ← History
      </Link>

      <Suspense fallback={<DetailFallback />}>
        <RunDetail params={params} />
      </Suspense>
    </AppShell>
  )
}

function DetailFallback() {
  return (
    <>
      <header className="mb-12 flex flex-col gap-4 md:mb-16">
        <Skeleton className="h-3 w-28" />
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <Skeleton className="h-9 w-80" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="h-3 w-40" />
      </header>
      <RunResultSkeleton />
    </>
  )
}

async function RunDetail({ params }: { params: Promise<{ runId: string }> }) {
  await requireSession()
  const { runId } = await params
  const run = await getCachedRunById(runId)
  if (!run) {
    notFound()
  }

  const [result, childRuns, parentRun] = await Promise.all([
    run.status === 'completed' ? getCachedRunResult(runId) : null,
    getCachedChildRunsForParent(runId),
    run.parentRunId ? getCachedRunById(run.parentRunId) : null,
  ])

  return (
    <>
      <header className="mb-12 border-foreground border-t-4 pt-6 md:mb-16">
        <p className="swiss-label mb-4 text-accent">09. Run</p>
        <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <h1 className="text-balance font-black font-serif text-4xl uppercase leading-[0.95] tracking-tighter md:text-6xl">
            {formatDateTime(run.startedAt)}
          </h1>
          <RunStatus
            initialStatus={toRunLifecycleStatus(run.status)}
            runId={run.id}
          />
        </div>
      </header>

      <RunLineage childRuns={childRuns} parentRun={parentRun} run={run} />
      <RunDetailMain resultContent={result?.content ?? null} run={run} />
    </>
  )
}

function RunLineage({
  run,
  parentRun,
  childRuns,
}: {
  childRuns: NonNullable<
    Awaited<ReturnType<typeof getCachedChildRunsForParent>>
  >
  parentRun: Awaited<ReturnType<typeof getCachedRunById>>
  run: NonNullable<Awaited<ReturnType<typeof getCachedRunById>>>
}) {
  if (!(run.parentRunId || childRuns.length > 0)) {
    return null
  }

  return (
    <section className="mb-10 border-foreground border-t-2 pt-5">
      <p className="swiss-label text-accent">Linked runs</p>
      {run.parentRunId && (
        <p className="mt-3 font-mono text-muted-foreground text-xs uppercase tracking-wider">
          Parent:{' '}
          <Link
            className="text-foreground underline"
            href={`/runs/${run.parentRunId}`}
          >
            {parentRun ? formatDateTime(parentRun.startedAt) : run.parentRunId}
          </Link>
          {run.parentToolId ? ` via ${run.parentToolId}` : ''}
        </p>
      )}
      {childRuns.length > 0 && (
        <ul className="mt-4 flex flex-col divide-y-2 divide-foreground border-foreground border-y-2">
          {childRuns.map((child) => (
            <li key={child.id}>
              <Link
                className="grid grid-cols-[1fr_auto] gap-4 py-3 font-mono text-xs uppercase tracking-wider transition-colors hover:bg-accent md:px-3"
                href={`/runs/${child.id}`}
              >
                <span>{formatDateTime(child.startedAt)}</span>
                <span>{child.status}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function RunDetailMain({
  run,
  resultContent,
}: {
  resultContent: string | null
  run: NonNullable<Awaited<ReturnType<typeof getCachedRunById>>>
}) {
  if (run.status === 'failed') {
    return (
      <div className="border-destructive border-t-2 pt-8">
        <p className="font-bold text-destructive text-xs uppercase tracking-[0.2em]">
          Run failed
        </p>
        {run.error ? (
          <pre className="mt-4 max-h-64 overflow-auto border-2 border-border bg-muted p-4 font-mono text-muted-foreground text-xs">
            {run.error}
          </pre>
        ) : null}
      </div>
    )
  }

  if (run.status === 'running') {
    return <RunProgress key={run.id} runId={run.id} />
  }

  return <RunResultView content={resultContent} />
}
