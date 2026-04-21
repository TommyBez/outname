import { Suspense } from "react"
import { notFound } from "next/navigation"
import Link from "next/link"
import { requireSession } from "@/lib/auth-guard"
import {
  getAgentByIdForUser,
  getRunsForAgent,
  getLatestRunForAgent,
  getDigestWithItems,
} from "@/lib/data"
import { RunStatus } from "@/components/run-status"
import { RunProgress } from "@/components/run-progress"
import { DigestView } from "@/components/digest-view"
import { formatRelative, formatDateTime } from "@/lib/format"
import type { Run } from "@/lib/db/schema"

type Params = Promise<{ agentId: string }>

export default function AgentOverviewPage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<OverviewSkeleton />}>
      <AgentOverview params={params} />
    </Suspense>
  )
}

async function AgentOverview({ params }: { params: Params }) {
  const { agentId } = await params
  const session = await requireSession()
  const agent = await getAgentByIdForUser(agentId, session.user.id)
  if (!agent) notFound()

  const [latest, runs] = await Promise.all([
    getLatestRunForAgent(agent.id),
    getRunsForAgent(agent.id, 20),
  ])

  return (
    <>
      <section>
        <div className="mb-8 flex items-baseline justify-between gap-4">
          <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Last run
          </h2>
          {latest && (
            <Link
              href={`/runs/${latest.id}`}
              className="font-mono text-xs uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
            >
              Open run →
            </Link>
          )}
        </div>
        <LastRunBody latest={latest} />
      </section>

      <section className="py-10">
        <h2 className="mb-4 font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
          History
        </h2>
        {runs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No runs yet.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border border-y border-border">
            {runs.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/runs/${r.id}`}
                  className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-1 py-3 transition-colors hover:bg-muted/30 sm:grid-cols-[auto_1fr_auto] sm:gap-8 sm:px-2"
                >
                  <RunStatus
                    runId={r.id}
                    initialStatus={r.status as "running" | "completed" | "failed"}
                    showTime={false}
                  />
                  <span className="min-w-0 truncate font-mono text-xs text-muted-foreground">
                    {r.id}
                  </span>
                  <span className="col-start-2 font-mono text-xs text-muted-foreground sm:col-auto sm:text-right">
                    {formatRelative(r.startedAt)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}

async function LastRunBody({ latest }: { latest: Run | null }) {
  if (!latest) {
    return (
      <p className="text-sm text-muted-foreground">
        No runs yet. Trigger one manually or wait for the next scheduled slot.
      </p>
    )
  }

  if (latest.status === "running" || latest.status === "scheduled") {
    return <RunProgress key={latest.id} runId={latest.id} />
  }

  if (latest.status === "failed") {
    return (
      <div className="flex flex-col gap-3">
        <p className="inline-flex items-center gap-3 text-sm">
          <span
            aria-hidden
            className="inline-block size-1.5 rounded-full bg-destructive"
          />
          <span className="text-destructive">Run failed</span>
          <span className="text-muted-foreground">
            · {formatDateTime(latest.startedAt)}
          </span>
        </p>
        {latest.error && (
          <pre className="max-h-64 overflow-auto rounded-md border border-border bg-muted/40 p-3 font-mono text-xs text-muted-foreground">
            {latest.error}
          </pre>
        )}
      </div>
    )
  }

  const { digest, items } = await getDigestWithItems(latest.id)
  return (
    <div className="flex flex-col gap-6">
      <p className="font-mono text-xs text-muted-foreground">
        {formatDateTime(latest.startedAt)} · {latest.emailsScanned} email
        {latest.emailsScanned === 1 ? "" : "s"} scanned
      </p>
      <DigestView items={items} summary={digest?.summary ?? null} />
    </div>
  )
}

function OverviewSkeleton() {
  return (
    <div className="border-t border-border pt-10">
      <div className="mb-6 h-3 w-20 animate-pulse rounded-sm bg-muted" />
      <div className="h-48 w-full animate-pulse rounded-sm bg-muted" />
    </div>
  )
}
