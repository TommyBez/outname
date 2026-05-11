'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { formatAgentInterval } from '@/agents/format'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export interface RegistryAgent {
  enabled: boolean
  heartbeatEnabled: boolean
  heartbeatIntervalMinutes: number
  id: string
  model: string
  name: string
  reflectionEnabled: boolean
  reflectionIntervalMinutes: number
}

export function AgentRegistry({ agents }: { agents: RegistryAgent[] }) {
  const [query, setQuery] = useState('')
  const visibleAgents = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) {
      return agents
    }
    return agents.filter((agent) =>
      [
        agent.name,
        agent.model,
        agent.enabled ? 'active' : 'paused',
        agent.heartbeatEnabled ? 'heartbeat' : 'heartbeat off',
        agent.reflectionEnabled ? 'reflection' : 'reflection off',
      ].some((value) => value.toLowerCase().includes(needle))
    )
  }, [agents, query])

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
        </div>
        <Input
          aria-label="Search agents"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search agents..."
          value={query}
        />
      </div>

      {visibleAgents.length === 0 ? (
        <div className="border-2 border-foreground bg-muted p-8">
          <p className="font-black font-serif text-2xl uppercase leading-none tracking-tighter">
            No matching agents.
          </p>
          <p className="mt-3 max-w-md text-muted-foreground text-sm">
            Try searching by name, model, active state, heartbeat, or
            reflection.
          </p>
        </div>
      ) : (
        <ul className="border-foreground border-y-2">
          {visibleAgents.map((agent) => (
            <li key={agent.id}>
              <AgentRegistryRow agent={agent} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function AgentRegistryRow({ agent }: { agent: RegistryAgent }) {
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
        </p>
        <Link
          className="mt-2 block text-pretty font-black font-serif text-3xl uppercase leading-none tracking-tighter transition-colors hover:text-accent"
          href={`/agents/${agent.id}`}
        >
          {agent.name}
        </Link>
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-muted-foreground text-xs">
          <span>
            {agent.heartbeatEnabled
              ? `Heartbeat ${formatAgentInterval(
                  agent.heartbeatIntervalMinutes
                )}`
              : 'Heartbeat off'}
          </span>
          <span>
            {agent.reflectionEnabled
              ? `Reflection ${formatAgentInterval(
                  agent.reflectionIntervalMinutes
                )}`
              : 'Reflection off'}
          </span>
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
