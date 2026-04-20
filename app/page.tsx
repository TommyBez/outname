import { Suspense } from "react"
import Link from "next/link"
import { requireSession } from "@/lib/auth-guard"
import {
  getAgentsForUser,
  getLatestRunForAgent,
  getDigestWithItems,
} from "@/lib/data"
import { getGmailConnection } from "@/lib/google-oauth"
import { AppShell } from "@/components/app-shell"
import { TodayDate } from "@/components/today-date"
import { AgentRunCard } from "@/components/agent-run-card"
import {
  ConnectionNoticeSkeleton,
  DigestSkeleton,
} from "@/components/skeletons"
import { AGENT_KINDS } from "@/workflows/agents/registry"

export default function DashboardPage() {
  return (
    <AppShell>
      <header className="mb-12 flex flex-col gap-2 md:mb-16">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
          <TodayDate />
        </p>
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <h1 className="font-serif text-4xl font-medium leading-[1.05] tracking-tight text-balance md:text-6xl">
            Today.
          </h1>
          <Link
            href="/agents/new"
            className="inline-flex shrink-0 items-center justify-center self-start rounded-md border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted md:self-auto"
          >
            + New agent
          </Link>
        </div>
      </header>

      <Suspense fallback={<ConnectionNoticeSkeleton />}>
        <ConnectionNotice />
      </Suspense>

      <Suspense fallback={<DigestSkeleton />}>
        <AgentsList />
      </Suspense>
    </AppShell>
  )
}

async function ConnectionNotice() {
  const connection = await getGmailConnection()
  const notConnected = !connection
  const expired = !!connection && connection.status !== "active"
  if (!notConnected && !expired) return null

  return (
    <div className="mb-12 border-y border-border py-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p
            className={`font-mono text-xs uppercase tracking-[0.2em] ${
              expired ? "text-destructive" : "text-muted-foreground"
            }`}
          >
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

async function AgentsList() {
  const session = await requireSession()
  const agents = await getAgentsForUser(session.user.id)

  if (agents.length === 0) {
    return (
      <div className="border-t border-border pt-10">
        <p className="font-serif text-2xl leading-snug">No agents yet.</p>
        <p className="mt-3 text-sm text-muted-foreground">
          Create your first agent to start automating recurring work.
        </p>
        <Link
          href="/agents/new"
          className="mt-6 inline-flex items-center justify-center rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90"
        >
          Create agent
        </Link>
      </div>
    )
  }

  return (
    <ul className="flex flex-col divide-y divide-border">
      {agents.map((a) => (
        <li key={a.id}>
          <AgentCardContainer agentId={a.id} />
        </li>
      ))}
    </ul>
  )
}

async function AgentCardContainer({ agentId }: { agentId: string }) {
  const session = await requireSession()
  const agents = await getAgentsForUser(session.user.id)
  const a = agents.find((x) => x.id === agentId)
  if (!a) return null

  const latest = await getLatestRunForAgent(a.id)
  const digest =
    latest && latest.status === "completed"
      ? await getDigestWithItems(latest.id)
      : null

  const kindMeta = AGENT_KINDS[a.kind as keyof typeof AGENT_KINDS]
  return (
    <AgentRunCard
      agent={a}
      kindLabel={kindMeta?.label ?? a.kind}
      latestRun={latest}
      digestItems={digest?.items ?? null}
      digestSummary={digest?.digest?.summary ?? null}
    />
  )
}
