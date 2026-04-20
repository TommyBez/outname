import { Suspense } from "react"
import { notFound } from "next/navigation"
import Link from "next/link"
import { getRunById, getDigestWithItems } from "@/lib/data"
import { AppShell } from "@/components/app-shell"
import { DigestView } from "@/components/digest-view"
import { RunStatus } from "@/components/run-status"
import { formatDateTime } from "@/lib/format"
import { DigestSkeleton } from "@/components/skeletons"
import { Skeleton } from "@/components/ui/skeleton"
import { RunProgress } from "@/components/run-progress"

export default function RunDetailPage({
  params,
}: {
  params: Promise<{ runId: string }>
}) {
  return (
    <AppShell>
      <Link
        href="/runs"
        className="mb-10 inline-block text-sm text-muted-foreground transition-colors hover:text-foreground"
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
      <DigestSkeleton />
    </>
  )
}

async function RunDetail({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params
  const run = await getRunById(runId)
  if (!run) notFound()

  const { digest, items } =
    run.status === "completed" ? await getDigestWithItems(runId) : { digest: null, items: [] }

  return (
    <>
      <header className="mb-12 flex flex-col gap-4 md:mb-16">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
          {run.trigger} run
        </p>
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <h1 className="font-serif text-3xl font-medium leading-tight tracking-tight text-balance md:text-4xl">
            {formatDateTime(run.startedAt)}
          </h1>
          <RunStatus runId={run.id} initialStatus={run.status as any} />
        </div>
        <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
          {run.emailsScanned} email{run.emailsScanned === 1 ? "" : "s"} scanned
        </p>
      </header>

      {run.status === "failed" ? (
        <div className="border-t border-destructive/30 pt-8">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-destructive">
            Run failed
          </p>
          {run.error && (
            <pre className="mt-4 max-h-64 overflow-auto rounded-md border border-border bg-muted/40 p-3 font-mono text-xs text-muted-foreground">
              {run.error}
            </pre>
          )}
        </div>
      ) : run.status === "running" ? (
        <RunProgress runId={run.id} />
      ) : (
        <DigestView items={items} summary={digest?.summary ?? null} />
      )}
    </>
  )
}
