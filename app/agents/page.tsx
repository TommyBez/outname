import Link from "next/link"
import { requireSession } from "@/lib/auth-guard"
import { getAgentsForUser, getLatestRunForAgent } from "@/lib/data"
import { AppShell } from "@/components/app-shell"
import { AGENT_KINDS } from "@/workflows/agents/registry"
import { formatRelative } from "@/lib/format"
import type { Agent, Run } from "@/lib/db/schema"

export default async function AgentsListPage() {
  const session = await requireSession()
  const agents = await getAgentsForUser(session.user.id)

  // Parallelize latest-run lookups
  const withLatest = await Promise.all(
    agents.map(async (a) => ({
      agent: a,
      latest: await getLatestRunForAgent(a.id),
    })),
  )

  return (
    <AppShell>
      <header className="mb-10 flex flex-col gap-2 md:mb-12">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Agents
        </p>
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <h1 className="font-serif text-4xl font-medium leading-tight tracking-tight md:text-5xl">
            Your agents.
          </h1>
          <Link
            href="/agents/new"
            className="inline-flex shrink-0 items-center justify-center self-start rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 md:self-auto"
          >
            + New agent
          </Link>
        </div>
      </header>

      {withLatest.length === 0 ? (
        <div className="border-t border-border pt-10">
          <p className="font-serif text-2xl leading-snug">Nothing scheduled.</p>
          <p className="mt-3 text-sm text-muted-foreground">
            Add an agent to automate recurring work like your morning email
            brief.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-border border-y border-border">
          {withLatest.map(({ agent, latest }) => (
            <li key={agent.id}>
              <AgentListRow agent={agent} latest={latest} />
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  )
}

function AgentListRow({ agent, latest }: { agent: Agent; latest: Run | null }) {
  const meta = AGENT_KINDS[agent.kind as keyof typeof AGENT_KINDS]
  return (
    <Link
      href={`/agents/${agent.id}`}
      className="grid grid-cols-1 gap-4 py-6 transition-colors hover:bg-muted/40 md:grid-cols-[1fr_auto_auto] md:items-center md:gap-8 md:px-2"
    >
      <div className="flex flex-col gap-1">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
          {meta?.label ?? agent.kind}
          {!agent.enabled && (
            <span className="ml-3 rounded-sm border border-border px-1.5 py-0.5 text-[10px] tracking-wider">
              PAUSED
            </span>
          )}
        </p>
        <p className="font-serif text-xl font-medium leading-tight">
          {agent.name}
        </p>
      </div>
      <div className="font-mono text-xs text-muted-foreground">
        {agent.scheduleTime} · {agent.scheduleDays.length}d/wk
      </div>
      <div className="font-mono text-xs text-muted-foreground">
        {latest ? formatRelative(latest.startedAt) : "Never run"}
      </div>
    </Link>
  )
}
