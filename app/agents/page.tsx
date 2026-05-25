import type { Metadata } from 'next'
import { Suspense } from 'react'
import {
  AgentRegistry,
  type RegistryAgent,
} from '@/agents/components/agent-registry'
import { requireSession } from '@/auth/server/auth-guard'
import { NewAgentLink } from '@/shared/components/ai-gateway-key-gate/new-agent-link'
import { AppShell } from '@/shared/components/layout/app-shell'
import type { Agent } from '@/shared/db/schema'
import { getCachedAgentsForUser } from '@/shared/server/data'
import { createPrivatePageMetadata } from '@/shared/server/site-metadata'
import { getUserTimeDisplay } from '@/shared/server/user-time-display'

export const metadata: Metadata = createPrivatePageMetadata(
  'Agents',
  'Manage personal AI agents, schedules, tools, and memory.'
)

export default function AgentsListPage() {
  return (
    <AppShell>
      <header className="mb-12 border-foreground border-t-4 pt-6">
        <div className="grid gap-8 md:grid-cols-[minmax(0,7fr)_minmax(14rem,3fr)] md:items-end">
          <div>
            <p className="swiss-label mb-4 text-accent">02. Agents</p>
            <h1 className="font-black font-serif text-5xl uppercase leading-[0.9] tracking-tighter sm:text-6xl lg:text-7xl xl:text-8xl">
              Your agents
            </h1>
          </div>
          <p className="max-w-xs border-foreground border-l-2 pl-4 text-muted-foreground text-sm leading-relaxed">
            The registry for every agent, with direct routes into chat,
            configuration, tools, and memory.
          </p>
          <NewAgentLink className="inline-flex h-14 shrink-0 items-center justify-center self-start border-2 border-foreground bg-foreground px-6 font-bold text-background text-xs uppercase tracking-[0.16em] transition-colors hover:border-accent hover:bg-accent hover:text-foreground md:self-auto">
            + New agent
          </NewAgentLink>
        </div>
      </header>

      <Suspense fallback={<AgentsListSkeleton />}>
        <AgentsListBody />
      </Suspense>
    </AppShell>
  )
}

async function AgentsListBody() {
  const session = await requireSession()
  const [agents, display] = await Promise.all([
    getCachedAgentsForUser(session.user.id),
    getUserTimeDisplay(session.user.id),
  ])

  if (agents.length === 0) {
    return (
      <div className="swiss-dots border-2 border-foreground bg-muted p-8 md:p-12">
        <p className="font-black font-serif text-3xl uppercase leading-none tracking-tighter">
          No agents yet.
        </p>
        <p className="mt-4 max-w-lg text-muted-foreground text-sm leading-relaxed">
          Add an agent to automate recurring work. Each agent runs on its own
          schedule and keeps its memory in a persistent sandbox.
        </p>
        <NewAgentLink className="mt-8 inline-flex h-14 items-center justify-center border-2 border-foreground bg-foreground px-6 font-bold text-background text-xs uppercase tracking-[0.16em] transition-colors hover:border-accent hover:bg-accent hover:text-foreground">
          Create agent
        </NewAgentLink>
      </div>
    )
  }

  return (
    <AgentRegistry
      agents={agents.map(toRegistryAgent)}
      timeZone={display.timeZone}
    />
  )
}

function AgentsListSkeleton() {
  return (
    <div className="border-foreground border-y-2">
      {[0, 1, 2].map((i) => (
        <div
          className="grid grid-cols-1 gap-4 border-foreground border-b-2 py-6 last:border-b-0 md:grid-cols-[1fr_auto] md:items-center md:gap-8 md:px-4"
          key={i}
        >
          <div className="flex flex-col gap-2">
            <div className="h-3 w-32 animate-pulse bg-muted" />
            <div className="h-8 w-56 animate-pulse bg-muted" />
          </div>
          <div className="h-10 w-64 animate-pulse bg-muted" />
        </div>
      ))}
    </div>
  )
}

function toRegistryAgent(agent: Agent): RegistryAgent {
  return {
    enabled: agent.enabled,
    heartbeatEnabled: agent.heartbeatEnabled,
    heartbeatScheduleMode: agent.heartbeatScheduleMode,
    heartbeatScheduleTimes: agent.heartbeatScheduleTimes,
    heartbeatIntervalMinutes: agent.heartbeatIntervalMinutes,
    id: agent.id,
    model: agent.model,
    name: agent.name,
    dreamingEnabled: agent.dreamingEnabled,
  }
}
