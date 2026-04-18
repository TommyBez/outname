import Link from "next/link"
import { requireSession } from "@/lib/auth-guard"
import { getLatestRun, getDigestWithItems } from "@/lib/data"
import { getGmailConnection } from "@/lib/google-oauth"
import { AppShell } from "@/components/app-shell"
import { DigestView } from "@/components/digest-view"
import { RunStatus } from "@/components/run-status"
import { TriggerButton } from "@/components/trigger-button"
import { CATEGORY_META, CATEGORY_ORDER } from "@/lib/categories"
import type { Category, DigestItem } from "@/lib/db/schema"
import { formatLongDate, formatRelative } from "@/lib/format"

export const dynamic = "force-dynamic"

export default async function DashboardPage() {
  await requireSession()
  const [latest, connection] = await Promise.all([getLatestRun(), getGmailConnection()])
  const { digest, items } = latest ? await getDigestWithItems(latest.id) : { digest: null, items: [] }
  const notConnected = !connection
  const expired = !!connection && connection.status !== "active"

  return (
    <AppShell>
      <header className="mb-12 flex flex-col gap-2 md:mb-16">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
          {formatLongDate(new Date())}
        </p>
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <h1 className="font-serif text-4xl font-medium leading-[1.05] tracking-tight text-balance md:text-6xl">
            Morning briefing.
          </h1>
          <div className="flex items-center gap-4 text-sm">
            {latest && <RunStatus runId={latest.id} initialStatus={latest.status as any} />}
            <TriggerButton variant="outline" />
          </div>
        </div>
      </header>

      {(notConnected || expired) && <ConnectionNotice expired={!!expired} />}

      {!latest ? (
        <EmptyState />
      ) : latest.status === "running" ? (
        <RunningState />
      ) : latest.status === "failed" ? (
        <FailedState error={latest.error} />
      ) : (
        <>
          <Summary items={items} latestRunAt={latest.startedAt} />
          <DigestView items={items} summary={digest?.summary ?? null} />
          <footer className="mt-16 border-t border-border pt-6">
            <Link
              href="/runs"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              View full history →
            </Link>
          </footer>
        </>
      )}
    </AppShell>
  )
}

function Summary({ items, latestRunAt }: { items: DigestItem[]; latestRunAt: Date }) {
  const counts = CATEGORY_ORDER.map((c) => ({
    c,
    n: items.filter((i) => i.category === (c as Category)).length,
  }))
  const total = items.length

  return (
    <section className="mb-14 grid grid-cols-1 gap-10 border-y border-border py-8 md:grid-cols-[auto_1fr] md:gap-16 md:py-10">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
          New since last run
        </p>
        <p className="mt-3 font-serif text-6xl font-medium leading-none tabular-nums md:text-7xl">
          {total}
        </p>
        <p className="mt-3 text-xs text-muted-foreground">
          {formatRelative(latestRunAt)}
        </p>
      </div>
      <dl className="grid grid-cols-2 gap-x-10 gap-y-6 self-end sm:grid-cols-4">
        {counts.map(({ c, n }) => {
          const meta = CATEGORY_META[c as Category]
          return (
            <div key={c} className="flex flex-col gap-1.5">
              <dt className={`font-mono text-xs uppercase tracking-wider ${meta.tone}`}>
                {meta.shortLabel}
              </dt>
              <dd className="font-serif text-3xl font-medium tabular-nums">
                {n.toString().padStart(2, "0")}
              </dd>
            </div>
          )
        })}
      </dl>
    </section>
  )
}

function ConnectionNotice({ expired }: { expired: boolean }) {
  return (
    <div className="mb-12 border-y border-border py-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className={`font-mono text-xs uppercase tracking-[0.2em] ${expired ? "text-destructive" : "text-muted-foreground"}`}>
            {expired ? "Connection expired" : "Not connected"}
          </p>
          <p className="mt-1.5 font-serif text-lg font-medium">
            {expired
              ? "Reconnect Gmail to resume your daily briefings."
              : "Connect Gmail so the agent can read your inbox."}
          </p>
        </div>
        <Link
          href="/api/google/connect"
          className="inline-flex shrink-0 items-center justify-center rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90"
        >
          {expired ? "Reconnect" : "Connect Gmail"}
        </Link>
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="border-t border-border pt-10">
      <p className="font-serif text-2xl leading-snug">No briefings yet.</p>
      <p className="mt-3 text-sm text-muted-foreground">
        Trigger your first run to read today&apos;s digest here.
      </p>
      <div className="mt-6">
        <TriggerButton label="Run first review" />
      </div>
    </div>
  )
}

function RunningState() {
  return (
    <div className="border-t border-border pt-10">
      <p className="font-serif text-2xl leading-snug">Reading your inbox.</p>
      <p className="mt-3 text-sm text-muted-foreground">
        The briefing will appear here when the run completes. The page will refresh automatically.
      </p>
    </div>
  )
}

function FailedState({ error }: { error: string | null }) {
  return (
    <div className="border-t border-destructive/30 pt-10">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-destructive">
        Last run failed
      </p>
      <p className="mt-3 font-serif text-2xl leading-snug">
        The briefing could not be generated.
      </p>
      {error && (
        <pre className="mt-4 max-h-48 overflow-auto rounded-md border border-border bg-muted/40 p-3 font-mono text-xs text-muted-foreground">
          {error}
        </pre>
      )}
      <div className="mt-6">
        <TriggerButton label="Retry" />
      </div>
    </div>
  )
}
