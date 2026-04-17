import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { requireSession } from "@/lib/auth-guard"
import { getRunById, getDigestWithItems } from "@/lib/data"
import { AppShell } from "@/components/app-shell"
import { DigestView } from "@/components/digest-view"
import { RunStatus } from "@/components/run-status"
import { formatDateTime } from "@/lib/format"

export const dynamic = "force-dynamic"

export default async function RunDetailPage({
  params,
}: {
  params: Promise<{ runId: string }>
}) {
  await requireSession()
  const { runId } = await params
  const run = await getRunById(runId)
  if (!run) notFound()

  const { digest, items } = await getDigestWithItems(runId)

  return (
    <AppShell>
      <Link
        href="/runs"
        className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to history
      </Link>

      <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            Run · {run.trigger}
          </p>
          <h1 className="mt-2 font-serif text-3xl font-medium">
            {formatDateTime(run.startedAt)}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {run.emailsScanned} email{run.emailsScanned === 1 ? "" : "s"} scanned ·{" "}
            id {run.id.slice(0, 8)}
          </p>
        </div>
        <RunStatus runId={run.id} initialStatus={run.status as any} />
      </div>

      {run.status === "failed" ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6">
          <p className="font-mono text-xs uppercase tracking-wider text-destructive">
            Failed
          </p>
          {run.error && (
            <pre className="mt-3 overflow-x-auto rounded-md bg-card p-3 font-mono text-xs text-muted-foreground">
              {run.error}
            </pre>
          )}
        </div>
      ) : run.status === "running" ? (
        <p className="text-sm text-muted-foreground">
          This run is still in progress. The page will refresh automatically.
        </p>
      ) : (
        <DigestView items={items} summary={digest?.summary ?? null} />
      )}
    </AppShell>
  )
}
