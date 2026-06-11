import { requireSession } from '@outname/auth/server/auth-guard'
import type { Agent } from '@outname/db/schema'
import {
  AgentRegistry,
  type RegistryAgent,
} from '@outname/shared/agents/components/agent-registry'
import { NewAgentLink } from '@outname/shared/agents/components/new-agent-link'
import { canCreateAgentForUser } from '@outname/shared/agents/server/creation-limit-access'
import { getCachedAgentsForUser } from '@outname/shared/server/data'
import { createPrivatePageMetadata } from '@outname/shared/server/site-metadata'
import { getUserTimeDisplay } from '@outname/shared/server/user-time-display'
import { AgentCardSkeleton } from '@outname/ui/components/skeletons'
import type { Metadata } from 'next'
import { Suspense } from 'react'

const NEW_AGENT_BUTTON_CLASS_NAME =
  'inline-flex h-14 shrink-0 items-center justify-center self-start border-2 border-foreground bg-foreground px-6 font-bold text-background text-xs uppercase tracking-[0.16em] transition-colors hover:border-accent hover:bg-accent hover:text-foreground md:self-auto'

const CREATE_AGENT_BUTTON_CLASS_NAME =
  'mt-8 inline-flex h-14 items-center justify-center border-2 border-foreground bg-foreground px-6 font-bold text-background text-xs uppercase tracking-[0.16em] transition-colors hover:border-accent hover:bg-accent hover:text-foreground'

const AGENTS_FALLBACK_KEYS = [
  'agents-fallback-1',
  'agents-fallback-2',
  'agents-fallback-3',
] as const

export const metadata: Metadata = createPrivatePageMetadata(
  'Agents',
  'Manage personal AI agents, schedules, tools, and memory.'
)

export default function AgentsListPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>
}) {
  return (
    <Suspense fallback={<AgentsListPageFallback />}>
      <AgentsListPageBody searchParams={searchParams} />
    </Suspense>
  )
}

async function AgentsListPageBody({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>
}) {
  const session = await requireSession()
  const [agents, display] = await Promise.all([
    getCachedAgentsForUser(session.user.id),
    getUserTimeDisplay(session.user.id),
  ])
  const [{ filter }, canCreateAgent] = await Promise.all([
    searchParams,
    canCreateAgentForUser({
      agentCount: agents.length,
      userId: session.user.id,
    }),
  ])

  return (
    <>
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
          <NewAgentLink
            canCreate={canCreateAgent}
            className={NEW_AGENT_BUTTON_CLASS_NAME}
          >
            + New agent
          </NewAgentLink>
        </div>
      </header>

      {agents.length === 0 ? (
        <div className="swiss-dots border-2 border-foreground bg-muted p-8 md:p-12">
          <p className="font-black font-serif text-3xl uppercase leading-none tracking-tighter">
            No agents yet.
          </p>
          <p className="mt-4 max-w-lg text-muted-foreground text-sm leading-relaxed">
            Add an agent to automate recurring work. Each agent runs on its own
            schedule and keeps its memory in a persistent sandbox.
          </p>
          <NewAgentLink
            canCreate={canCreateAgent}
            className={CREATE_AGENT_BUTTON_CLASS_NAME}
          >
            Create agent
          </NewAgentLink>
        </div>
      ) : (
        <AgentRegistry
          agents={agents.map(toRegistryAgent)}
          initialFilter={filter}
          timeZone={display.timeZone}
        />
      )}
    </>
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

function AgentsListPageFallback() {
  return (
    <>
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
          <div
            aria-hidden="true"
            className="h-14 w-36 animate-pulse bg-muted"
          />
        </div>
      </header>

      <ul className="border-foreground border-y-2">
        {AGENTS_FALLBACK_KEYS.map((key) => (
          <li key={key}>
            <AgentCardSkeleton />
          </li>
        ))}
      </ul>
    </>
  )
}
