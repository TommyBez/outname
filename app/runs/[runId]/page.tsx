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
import { getCachedRunById, getCachedRunResult } from '@/lib/data'
import { formatDateTime } from '@/lib/format'

export default function RunDetailPage({
  params,
}: {
  params: Promise<{ runId: string }>
}) {
  return (
    <AppShell>
      <Link
        className="mb-10 inline-block text-muted-foreground text-sm transition-colors hover:text-foreground"
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

  const result =
    run.status === 'completed' ? await getCachedRunResult(runId) : null

  return (
    <>
      <header className="mb-12 flex flex-col gap-4 md:mb-16">
        <p className="font-mono text-muted-foreground text-xs uppercase tracking-[0.2em]">
          Run
        </p>
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <h1 className="text-balance font-medium font-serif text-3xl leading-tight tracking-tight md:text-4xl">
            {formatDateTime(run.startedAt)}
          </h1>
          <RunStatus initialStatus={run.status as any} runId={run.id} />
        </div>
      </header>

      {run.status === 'failed' ? (
        <div className="border-destructive/30 border-t pt-8">
          <p className="font-mono text-destructive text-xs uppercase tracking-[0.2em]">
            Run failed
          </p>
          {run.error && (
            <pre className="mt-4 max-h-64 overflow-auto rounded-md border border-border bg-muted/40 p-3 font-mono text-muted-foreground text-xs">
              {run.error}
            </pre>
          )}
        </div>
      ) : run.status === 'running' ? (
        <RunProgress key={run.id} runId={run.id} />
      ) : (
        <RunResultView content={result?.content ?? null} />
      )}
    </>
  )
}
