import Link from "next/link"
import { ArrowRight, AlertTriangle, Link2 } from "lucide-react"
import { requireSession } from "@/lib/auth-guard"
import { getLatestRun, getDigestWithItems } from "@/lib/data"
import { getGmailConnection } from "@/lib/google-oauth"
import { AppShell } from "@/components/app-shell"
import { DigestView } from "@/components/digest-view"
import { RunStatus } from "@/components/run-status"
import { TriggerButton } from "@/components/trigger-button"
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyContent } from "@/components/ui/empty"
import { formatDateTime } from "@/lib/format"
import { Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"

export const dynamic = "force-dynamic"

export default async function DashboardPage() {
  await requireSession()
  const [latest, connection] = await Promise.all([getLatestRun(), getGmailConnection()])
  const { digest, items } = latest ? await getDigestWithItems(latest.id) : { digest: null, items: [] }
  const notConnected = !connection
  const expired = connection && connection.status !== "active"

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

      {(notConnected || expired) && (
        <div
          className={`mb-8 flex items-start gap-3 rounded-lg border p-4 ${
            expired
              ? "border-destructive/40 bg-destructive/5"
              : "border-[var(--color-accent)]/40 bg-[var(--color-accent)]/10"
          }`}
        >
          <AlertTriangle
            className={`mt-0.5 size-5 shrink-0 ${
              expired ? "text-destructive" : "text-[var(--color-accent)]"
            }`}
          />
          <div className="flex-1">
            <p className="font-medium">
              {expired ? "Gmail connection expired" : "Gmail is not connected"}
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {expired
                ? "The last authentication attempt failed. Reconnect to resume daily digests."
                : "Connect your Google account so the agent can read your inbox. Read-only access."}
            </p>
          </div>
          <Button asChild size="sm">
            <Link href="/api/google/connect">
              <Link2 className="mr-2 size-4" />
              {expired ? "Reconnect" : "Connect Gmail"}
            </Link>
          </Button>
        </div>
      )}

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
