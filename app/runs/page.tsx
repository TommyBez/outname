import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { requireSession } from "@/lib/auth-guard"
import { getAllRuns } from "@/lib/data"
import { AppShell } from "@/components/app-shell"
import { RunStatus } from "@/components/run-status"
import { TriggerButton } from "@/components/trigger-button"
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@/components/ui/empty"
import { formatDateTime } from "@/lib/format"

export const dynamic = "force-dynamic"

export default async function RunsPage() {
  await requireSession()
  const runs = await getAllRuns()

  return (
    <AppShell>
      <div className="mb-8 flex items-end justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            History
          </p>
          <h1 className="mt-2 font-serif text-3xl font-medium">All runs</h1>
        </div>
        <TriggerButton variant="outline" />
      </div>

      {runs.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>No runs yet</EmptyTitle>
            <EmptyDescription>Trigger your first inbox review to see it here.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-card">
          {runs.map((run) => (
            <li key={run.id}>
              <Link
                href={`/runs/${run.id}`}
                className="grid grid-cols-[1fr_auto_auto] items-center gap-4 px-5 py-4 transition-colors hover:bg-secondary/40"
              >
                <div className="flex flex-col gap-1 min-w-0">
                  <span className="truncate font-medium">
                    {formatDateTime(run.startedAt)}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {run.trigger} · {run.emailsScanned} emails · id {run.id.slice(0, 8)}
                  </span>
                </div>
                <RunStatus runId={run.id} initialStatus={run.status as any} compact />
                <ChevronRight className="size-4 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  )
}
