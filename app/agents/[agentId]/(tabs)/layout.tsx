import { Suspense } from "react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { requireSession } from "@/lib/auth-guard"
import { getAgentByIdForUser } from "@/lib/data"
import { AppShell } from "@/components/app-shell"
import { AgentTabs } from "@/components/agent-tabs"
import { AGENT_KINDS } from "@/workflows/agents/registry"
import { getAgentRuntime } from "@/lib/agent-runtime-registry"
import { TriggerButton } from "@/components/trigger-button"
import type { AgentKind } from "@/lib/db/schema"

type Params = Promise<{ agentId: string }>

function formatDays(days: number[]): string {
  if (days.length === 7) return "Every day"
  const weekdays = [1, 2, 3, 4, 5]
  if (weekdays.every((d) => days.includes(d)) && days.length === 5) {
    return "Weekdays"
  }
  const names = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
  return days
    .slice()
    .sort((a, b) => a - b)
    .map((d) => names[d] ?? "")
    .filter(Boolean)
    .join(" · ")
}

/**
 * Shell layout for the tabbed agent detail views (Overview, Chat).
 * Sits inside a `(tabs)` route group so the Edit page at
 * `/agents/[agentId]/edit` stays untouched with its own AppShell.
 *
 * The agent row is read via the `React.cache`-wrapped
 * `getAgentByIdForUser`, so the page below us reuses the same fetch.
 */
export default function AgentTabsLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Params
}) {
  return (
    <AppShell>
      <Link
        href="/"
        className="mb-6 inline-block font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground transition-colors hover:text-foreground"
      >
        ← Today
      </Link>
      <Suspense fallback={<HeaderSkeleton />}>
        <AgentHeader params={params} />
      </Suspense>
      {children}
    </AppShell>
  )
}

async function AgentHeader({ params }: { params: Params }) {
  const { agentId } = await params
  const session = await requireSession()
  const agent = await getAgentByIdForUser(agentId, session.user.id)
  if (!agent) notFound()

  const meta = AGENT_KINDS[agent.kind as AgentKind]
  const runtime = getAgentRuntime(agent.kind as AgentKind)
  const hasChat = Boolean(runtime?.buildAgent)

  const tabs = [
    { key: "overview", label: "Overview", href: `/agents/${agent.id}` },
    {
      key: "chat",
      label: "Chat",
      href: `/agents/${agent.id}/chat`,
      disabled: !hasChat,
      disabledReason: hasChat
        ? undefined
        : "This agent kind does not support chat yet.",
    },
  ]

  return (
    <>
      <header className="mb-10 flex flex-col gap-6">
        <div className="flex flex-col gap-1.5">
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
            <span>{meta?.label ?? agent.kind}</span>
            {!agent.enabled && (
              <span className="rounded-sm border border-border px-1.5 py-0.5 text-[10px] tracking-wider">
                PAUSED
              </span>
            )}
          </p>
          <h1 className="font-serif text-4xl font-medium leading-tight tracking-tight md:text-5xl">
            {agent.name}
          </h1>
          <p className="font-mono text-xs text-muted-foreground">
            {formatDays(agent.scheduleDays)} · {agent.scheduleTime}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <TriggerButton agentId={agent.id} />
          <Link
            href={`/agents/${agent.id}/edit`}
            className="inline-flex items-center justify-center rounded-md border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
          >
            Configure
          </Link>
        </div>
      </header>
      <AgentTabs tabs={tabs} />
    </>
  )
}

function HeaderSkeleton() {
  return (
    <header className="mb-10 flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="h-3 w-24 animate-pulse rounded-sm bg-muted" />
        <div className="h-10 w-64 animate-pulse rounded-sm bg-muted" />
        <div className="h-3 w-40 animate-pulse rounded-sm bg-muted" />
      </div>
      <div className="flex items-center gap-3">
        <div className="h-9 w-24 animate-pulse rounded-md bg-muted" />
        <div className="h-9 w-24 animate-pulse rounded-md bg-muted" />
      </div>
    </header>
  )
}
