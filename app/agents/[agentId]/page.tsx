import { Suspense } from "react"
import { notFound } from "next/navigation"
import Link from "next/link"
import { requireSession } from "@/lib/auth-guard"
import {
  getAgentByIdForUser,
  getRunsForAgent,
} from "@/lib/data"
import { AppShell } from "@/components/app-shell"
import { AgentForm } from "@/components/agent-form"
import { TriggerButton } from "@/components/trigger-button"
import { RunStatus } from "@/components/run-status"
import { updateAgentAction, deleteAgentAction } from "@/lib/agent-actions"
import { AGENT_KINDS } from "@/workflows/agents/registry"
import { formatRelative } from "@/lib/format"

type Params = Promise<{ agentId: string }>

export default function AgentDetailPage({ params }: { params: Params }) {
  return (
    <AppShell>
      <Link
        href="/agents"
        className="mb-6 inline-block font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground transition-colors hover:text-foreground"
      >
        ← Agents
      </Link>
      <Suspense fallback={<DetailSkeleton />}>
        <AgentDetail params={params} />
      </Suspense>
    </AppShell>
  )
}

async function AgentDetail({ params }: { params: Params }) {
  const { agentId } = await params
  const session = await requireSession()
  const agent = await getAgentByIdForUser(agentId, session.user.id)
  if (!agent) notFound()

  const runs = await getRunsForAgent(agent.id, 20)
  const meta = AGENT_KINDS[agent.kind as keyof typeof AGENT_KINDS]

  async function update(formData: FormData) {
    "use server"
    await updateAgentAction(agentId, formData)
  }

  async function remove() {
    "use server"
    await deleteAgentAction(agentId)
  }

  return (
    <>
      <header className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-1">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
            {meta?.label ?? agent.kind}
          </p>
          <h1 className="font-serif text-4xl font-medium leading-tight tracking-tight md:text-5xl">
            {agent.name}
          </h1>
        </div>
        <TriggerButton agentId={agent.id} />
      </header>

      <section className="border-y border-border py-10">
        <AgentForm
          mode="edit"
          agent={agent}
          kindLabel={meta?.label ?? agent.kind}
          action={update}
        />
      </section>

      <section className="py-10">
        <h2 className="mb-4 font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Recent runs
        </h2>
        {runs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No runs yet.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border border-y border-border">
            {runs.map((r) => (
              <li
                key={r.id}
                className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-1 py-3 sm:grid-cols-[auto_1fr_auto] sm:gap-8"
              >
                <RunStatus
                  runId={r.id}
                  initialStatus={r.status as "running" | "completed" | "failed"}
                  showTime={false}
                />
                <Link
                  href={`/runs/${r.id}`}
                  className="min-w-0 truncate font-mono text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  {r.id}
                </Link>
                <span className="col-start-2 font-mono text-xs text-muted-foreground sm:col-auto sm:text-right">
                  {formatRelative(r.startedAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3 border-t border-destructive/30 pt-6 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-destructive">
          Danger zone
        </p>
        <form action={remove} className="self-start sm:self-auto">
          <button
            type="submit"
            className="rounded-md border border-destructive/50 px-3 py-1.5 text-sm text-destructive transition-colors hover:bg-destructive hover:text-background"
          >
            Delete agent
          </button>
        </form>
      </section>
    </>
  )
}

function DetailSkeleton() {
  return (
    <>
      <header className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-2">
          <div className="h-3 w-24 animate-pulse rounded-sm bg-muted" />
          <div className="h-10 w-64 animate-pulse rounded-sm bg-muted" />
        </div>
        <div className="h-10 w-28 animate-pulse rounded-md bg-muted" />
      </header>
      <div className="space-y-6 border-y border-border py-10">
        <div className="h-6 w-32 animate-pulse rounded-sm bg-muted" />
        <div className="h-32 w-full animate-pulse rounded-sm bg-muted" />
      </div>
    </>
  )
}
