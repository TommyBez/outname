'use client'

import type { AgentScheduleMode } from '@outname/shared/agent-schedule'
import { formatAgentScheduleInline } from '@outname/shared/agents/format'
import { Button } from '@outname/ui/components/ui/button'
import { Input } from '@outname/ui/components/ui/input'
import { cn } from '@outname/ui/lib/utils'
import { X } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
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

export function AgentRegistry({
  agents,
  timeZone,
}: {
  agents: RegistryAgent[]
  timeZone: string
}) {
  const router = useRouter()
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
        agent.dreamingEnabled ? 'dreaming' : 'dreaming off',
      ].some((value) => value.toLowerCase().includes(needle))
    )
  }, [agents, query])

  return (
    <section aria-labelledby="agent-registry-heading">
      <div className="mb-6 grid gap-4 border-border border-b py-5 md:grid-cols-[minmax(0,1fr)_18rem] md:items-center">
        <div>
          <h2
            className="font-semibold text-xl tracking-tight"
            id="agent-registry-heading"
          >
            Registry
          </h2>
          <p className="mt-2 text-muted-foreground text-sm">
            Find an agent, inspect its operating mode, and jump straight to the
            workspace surface you need.
          </p>
        </div>
        <div>
          <div className="relative">
            <Input
              aria-label="Search agents. Press Enter to open the first match."
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && visibleAgents[0]) {
                  event.preventDefault()
                  router.push(`/agents/${visibleAgents[0].id}`)
                }
                if (event.key === 'Escape') {
                  setQuery('')
                }
              }}
              placeholder="Search agents..."
              value={query}
            />
            {query ? (
              <Button
                aria-label="Clear search"
                className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground"
                onClick={() => setQuery('')}
                size="icon-sm"
                type="button"
                variant="ghost"
              >
                <X aria-hidden className="size-4" />
              </Button>
            ) : null}
          </div>
          <p
            aria-live="polite"
            className="mt-2 font-mono text-muted-foreground text-xs"
          >
            {query
              ? `${visibleAgents.length} of ${agents.length} agents · Enter opens first match`
              : `${agents.length} agents`}
          </p>
        </div>
      </div>

      {visibleAgents.length === 0 ? (
        <div className="border border-border bg-muted p-8">
          <p className="font-semibold font-serif text-2xl leading-none tracking-tighter">
            No agents match “{query}”.
          </p>
          <p className="mt-3 max-w-md text-muted-foreground text-sm">
            Try searching by name, model, active state, heartbeat, or dreaming —
            or clear the search to see all {agents.length} agents.
          </p>
          <Button
            className="mt-6"
            onClick={() => setQuery('')}
            size="sm"
            type="button"
            variant="outline"
          >
            Clear search
          </Button>
        </div>
      ) : (
        <ul className="border-border border-b">
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
    <article className="grid gap-5 border-border border-b py-6 last:border-b-0 md:grid-cols-[minmax(0,1fr)_minmax(16rem,22rem)] md:items-center md:px-4">
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 font-bold text-[10px] text-muted-foreground">
          <span>{agent.model}</span>
          <span
            className={cn(
              'border px-1.5 py-0.5',
              agent.enabled
                ? 'border-border text-foreground'
                : 'border-border text-muted-foreground'
            )}
          >
            {agent.enabled ? 'Active' : 'Paused'}
          </span>
        </p>
        <Link
          className="mt-2 block text-pretty font-semibold text-xl tracking-tight transition-colors hover:text-brand"
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
    <Button asChild size="sm" variant="outline">
      <Link href={href}>{label}</Link>
    </Button>
  )
}
