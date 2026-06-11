'use client'

import type { AgentScheduleMode } from '@outname/shared/agent-schedule'
import { formatAgentScheduleInline } from '@outname/shared/agents/format'
import { Input } from '@outname/ui/components/ui/input'
import { cn } from '@outname/ui/lib/utils'
import Link from 'next/link'
import { useMemo, useState } from 'react'

export interface RegistryAgent {
  dreamingEnabled: boolean
  enabled: boolean
  heartbeatEnabled: boolean
  heartbeatIntervalMinutes: number
  heartbeatScheduleMode: AgentScheduleMode
  heartbeatScheduleTimes: string[]
  id: string
  model: string
  name: string
}

type RegistryFilter = 'all' | 'active' | 'paused' | 'setup'

const FILTERS: Array<{ label: string; value: RegistryFilter }> = [
  { label: 'All', value: 'all' },
  { label: 'Active', value: 'active' },
  { label: 'Paused', value: 'paused' },
  { label: 'Needs setup', value: 'setup' },
]

export function AgentRegistry({
  agents,
  initialFilter,
  timeZone,
}: {
  agents: RegistryAgent[]
  initialFilter?: string
  timeZone: string
}) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<RegistryFilter>(
    normalizeRegistryFilter(initialFilter)
  )
  const agentCounts = useMemo(() => getAgentCounts(agents), [agents])
  const visibleAgents = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return agents.filter((agent) => {
      const matchesFilter = matchesRegistryFilter(agent, filter)
      if (!(needle && matchesFilter)) {
        return matchesFilter
      }
      return [
        agent.name,
        agent.model,
        agent.enabled ? 'active' : 'paused',
        agent.heartbeatEnabled ? 'heartbeat' : 'heartbeat off',
        agent.dreamingEnabled ? 'dreaming' : 'dreaming off',
      ].some((value) => value.toLowerCase().includes(needle))
    })
  }, [agents, filter, query])

  const clearFilters = () => {
    setFilter('all')
    setQuery('')
  }

  return (
    <section aria-labelledby="agent-registry-heading">
      <div className="mb-6 grid gap-4 border-foreground border-y-2 py-5 md:grid-cols-[minmax(0,1fr)_18rem] md:items-center">
        <div>
          <h2
            className="font-black font-serif text-3xl uppercase leading-none tracking-tighter"
            id="agent-registry-heading"
          >
            Registry
          </h2>
          <p className="mt-2 text-muted-foreground text-sm">
            Find an agent, inspect its operating mode, and jump straight to the
            workspace surface you need.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {FILTERS.map((item) => (
              <button
                aria-pressed={filter === item.value}
                className={cn(
                  'inline-flex h-9 items-center border-2 border-foreground px-3 font-bold text-[10px] uppercase tracking-[0.16em] transition-colors hover:bg-foreground hover:text-background',
                  filter === item.value
                    ? 'bg-foreground text-background'
                    : 'bg-background text-foreground'
                )}
                key={item.value}
                onClick={() => setFilter(item.value)}
                type="button"
              >
                {item.label} {filterCountLabel(item.value, agentCounts)}
              </button>
            ))}
          </div>
        </div>
        <div>
          <Input
            aria-label="Search agents"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search agents..."
            value={query}
          />
          <p className="mt-2 font-mono text-muted-foreground text-xs">
            Showing {visibleAgents.length} of {agents.length}
          </p>
        </div>
      </div>

      {visibleAgents.length === 0 ? (
        <div className="border-2 border-foreground bg-muted p-8">
          <p className="font-black font-serif text-2xl uppercase leading-none tracking-tighter">
            No matching agents.
          </p>
          <p className="mt-3 max-w-md text-muted-foreground text-sm">
            Try another name, model, operating state, or clear the current
            search and status filter.
          </p>
          <button
            className="mt-5 inline-flex h-10 items-center justify-center border-2 border-foreground px-3 font-bold text-[10px] uppercase tracking-[0.16em] transition-colors hover:bg-foreground hover:text-background"
            onClick={clearFilters}
            type="button"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <ul className="border-foreground border-y-2">
          {visibleAgents.map((agent) => (
            <li key={agent.id}>
              <AgentRegistryRow agent={agent} timeZone={timeZone} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function AgentRegistryRow({
  agent,
  timeZone,
}: {
  agent: RegistryAgent
  timeZone: string
}) {
  return (
    <article className="grid gap-5 border-foreground border-b-2 py-6 last:border-b-0 md:grid-cols-[minmax(0,1fr)_minmax(16rem,22rem)] md:items-center md:px-4">
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 font-bold text-[10px] text-muted-foreground uppercase tracking-[0.2em]">
          <span>{agent.model}</span>
          <span
            className={cn(
              'border px-1.5 py-0.5',
              agent.enabled
                ? 'border-foreground text-foreground'
                : 'border-border text-muted-foreground'
            )}
          >
            {agent.enabled ? 'Active' : 'Paused'}
          </span>
          {needsSetup(agent) ? (
            <span className="border border-border px-1.5 py-0.5 text-muted-foreground">
              Needs setup
            </span>
          ) : null}
        </p>
        <Link
          className="mt-2 block text-pretty font-black font-serif text-3xl uppercase leading-none tracking-tighter transition-colors hover:text-accent"
          href={`/agents/${agent.id}`}
        >
          {agent.name}
        </Link>
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-muted-foreground text-xs">
          <span>
            {`Heartbeat ${formatAgentScheduleInline({
              enabled: agent.heartbeatEnabled,
              intervalMinutes: agent.heartbeatIntervalMinutes,
              mode: agent.heartbeatScheduleMode,
              timeZone,
              times: agent.heartbeatScheduleTimes,
            })}`}
          </span>
          <span>{`Dreaming ${agent.dreamingEnabled ? 'daily' : 'off'}`}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-2 xl:grid-cols-4">
        <RegistryAction href={`/agents/${agent.id}`} label="Overview" />
        <RegistryAction href={`/agents/${agent.id}/chat`} label="Chat" />
        <RegistryAction
          href={`/agents/${agent.id}/configure`}
          label="Configure"
        />
        <RegistryAction href={`/agents/${agent.id}/tools`} label="Tools" />
      </div>
    </article>
  )
}

function RegistryAction({ href, label }: { href: string; label: string }) {
  return (
    <Link
      className="inline-flex h-10 items-center justify-center border-2 border-foreground px-3 font-bold text-[10px] uppercase tracking-[0.14em] transition-colors hover:bg-foreground hover:text-background"
      href={href}
    >
      {label}
    </Link>
  )
}

function normalizeRegistryFilter(filter: string | undefined): RegistryFilter {
  if (filter === 'active' || filter === 'paused' || filter === 'setup') {
    return filter
  }
  if (filter === 'attention') {
    return 'paused'
  }
  return 'all'
}

function matchesRegistryFilter(
  agent: RegistryAgent,
  filter: RegistryFilter
): boolean {
  switch (filter) {
    case 'active':
      return agent.enabled
    case 'paused':
      return !agent.enabled
    case 'setup':
      return needsSetup(agent)
    case 'all':
      return true
    default:
      return true
  }
}

function needsSetup(agent: RegistryAgent): boolean {
  return !(agent.heartbeatEnabled && agent.dreamingEnabled)
}

function getAgentCounts(agents: RegistryAgent[]) {
  let active = 0
  let paused = 0
  let setup = 0
  for (const agent of agents) {
    if (agent.enabled) {
      active += 1
    } else {
      paused += 1
    }
    if (needsSetup(agent)) {
      setup += 1
    }
  }
  return { active, all: agents.length, paused, setup }
}

function filterCountLabel(
  filter: RegistryFilter,
  counts: ReturnType<typeof getAgentCounts>
) {
  return `(${counts[filter]})`
}
