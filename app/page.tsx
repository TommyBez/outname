import { Suspense } from "react"
import Link from "next/link"
import { requireSession } from "@/lib/auth-guard"
import {
  getCachedAgentsForUser,
  getCachedLatestRunForAgent,
} from "@/lib/data"
import { getCachedGmailConnectionForUser } from "@/lib/google-oauth"
import { AppShell } from "@/components/app-shell"
import { TodayDate } from "@/components/today-date"
import { AgentTodayCard } from "@/components/agent-today-card"
import {
  AgentCardSkeleton,
  ConnectionNoticeSkeleton,
  DigestSkeleton,
} from "@/components/skeletons"
import type { Agent } from "@/lib/db/schema"
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

      <Suspense fallback={<DashboardContentFallback />}>
        <DashboardContent />
      </Suspense>
    </AppShell>
  )
}

async function DashboardContent() {
  const session = await requireSession()

  return (
    <>
      <Suspense fallback={<ConnectionNoticeSkeleton />}>
        <ConnectionNotice userId={session.user.id} />
      </Suspense>

      <Suspense fallback={<DigestSkeleton />}>
        <AgentsList userId={session.user.id} />
      </Suspense>
    </>
  )
}

async function ConnectionNotice({ userId }: { userId: string }) {
  const connection = await getCachedGmailConnectionForUser(userId)
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

async function AgentsList({ userId }: { userId: string }) {
  const agents = await getCachedAgentsForUser(userId)

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
          <Suspense fallback={<AgentCardSkeleton />}>
            <AgentCardContainer agent={a} />
          </Suspense>
        </li>
      ))}
    </ul>
  )
}

async function AgentCardContainer({ agent }: { agent: Agent }) {
  const latest = await getCachedLatestRunForAgent(agent.id)
  const kindMeta = AGENT_KINDS[agent.kind as keyof typeof AGENT_KINDS]
  return (
    <AgentTodayCard
      agent={agent}
      kindLabel={kindMeta?.label ?? agent.kind}
      latestRun={latest}
    />
  )
}

function DashboardContentFallback() {
  return (
    <>
      <ConnectionNoticeSkeleton />
      <DigestSkeleton />
    </>
  )
}
