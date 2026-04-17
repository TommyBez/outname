import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { requireSession } from "@/lib/auth-guard"
import { getLatestRun, getDigestWithItems } from "@/lib/data"
import { AppShell } from "@/components/app-shell"
import { DigestView } from "@/components/digest-view"
import { RunStatus } from "@/components/run-status"
import { TriggerButton } from "@/components/trigger-button"
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyContent } from "@/components/ui/empty"
import { formatDateTime } from "@/lib/format"
import { Sparkles } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function DashboardPage() {
  await requireSession()
  const latest = await getLatestRun()
  const { digest, items } = latest ? await getDigestWithItems(latest.id) : { digest: null, items: [] }

  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  })

  return (
    <AppShell>
      <div className="mb-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            {today}
          </p>
          <h1 className="mt-2 text-balance font-serif text-4xl font-medium leading-tight md:text-5xl">
            Your morning briefing.
          </h1>
          {latest && (
            <p className="mt-3 text-sm text-muted-foreground">
              Last run {formatDateTime(latest.startedAt)} ·{" "}
              {latest.emailsScanned} email{latest.emailsScanned === 1 ? "" : "s"} scanned
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {latest && (
            <RunStatus runId={latest.id} initialStatus={latest.status as any} />
          )}
          <TriggerButton />
        </div>
      </div>

      {!latest ? (
        <Empty>
          <EmptyHeader>
            <Sparkles className="size-10 text-muted-foreground" />
            <EmptyTitle>No runs yet</EmptyTitle>
            <EmptyDescription>
              Trigger your first inbox review to see the digest here.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <TriggerButton label="Run first review" />
          </EmptyContent>
        </Empty>
      ) : latest.status === "running" ? (
        <RunningState />
      ) : latest.status === "failed" ? (
        <FailedState error={latest.error} />
      ) : (
        <DigestView items={items} summary={digest?.summary ?? null} />
      )}

      {latest && (
        <div className="mt-12 border-t border-border pt-6">
          <Link
            href="/runs"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            View full history
            <ArrowRight className="size-4" />
          </Link>
        </div>
      )}
    </AppShell>
  )
}

function RunningState() {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyTitle>Reviewing your inbox…</EmptyTitle>
        <EmptyDescription>
          The agent is reading, classifying, and summarizing. This page will refresh when it&apos;s done.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}

function FailedState({ error }: { error: string | null }) {
  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6">
      <p className="font-mono text-xs uppercase tracking-wider text-destructive">
        Run failed
      </p>
      <p className="mt-2 text-sm text-foreground">
        The last inbox review could not complete.
      </p>
      {error && (
        <pre className="mt-3 overflow-x-auto rounded-md bg-card p-3 font-mono text-xs text-muted-foreground">
          {error}
        </pre>
      )}
      <div className="mt-4">
        <TriggerButton label="Retry" variant="outline" />
      </div>
    </div>
  )
}
