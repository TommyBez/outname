'use client'

import {
  Activity,
  Bot,
  ChevronRight,
  Database,
  MessageSquare,
  Settings,
  Wrench,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { TriggerButton } from '@/agents/components/trigger-button'
import { formatAgentScheduleInline } from '@/agents/format'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { AgentScheduleMode } from '@/shared/agent-schedule'
import { useUserTimezone } from '@/shared/components/user-timezone-context'

interface HeaderAgent {
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

const WORKSPACE_TABS = [
  { key: 'overview', label: 'Overview', icon: Bot },
  { key: 'chat', label: 'Chat', icon: MessageSquare },
  { key: 'events', label: 'Events', icon: Activity },
  { key: 'configure', label: 'Configure', icon: Settings },
  { key: 'tools', label: 'Tools', icon: Wrench },
  { key: 'memory', label: 'Memory', icon: Database },
] as const

export function AgentWorkspaceHeader({ agent }: { agent: HeaderAgent }) {
  const timeZone = useUserTimezone()
  const pathname = usePathname()

  return (
    <>
      <header className="border-foreground border-t-4 pt-6">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
          <div className="min-w-0">
            <nav
              aria-label="Breadcrumb"
              className="mb-4 flex min-w-0 items-center gap-2"
            >
              <Link
                className="font-bold text-muted-foreground text-xs uppercase tracking-[0.2em] transition-colors hover:text-accent"
                href="/agents"
              >
                Agents
              </Link>
              <ChevronRight
                aria-hidden
                className="size-3 shrink-0 text-muted-foreground/60"
              />
              <span className="truncate font-bold text-muted-foreground text-xs uppercase tracking-[0.2em]">
                {agent.name}
              </span>
            </nav>
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={agent.enabled ? 'default' : 'outline'}>
                  {agent.enabled ? 'Active' : 'Paused'}
                </Badge>
                <Badge variant="outline">{agent.model}</Badge>
                <Badge variant="secondary">
                  {`Heartbeat ${formatAgentScheduleInline({
                    enabled: agent.heartbeatEnabled,
                    intervalMinutes: agent.heartbeatIntervalMinutes,
                    mode: agent.heartbeatScheduleMode,
                    timeZone,
                    times: agent.heartbeatScheduleTimes,
                  })}`}
                </Badge>
                <Badge variant="secondary">
                  {`Dreaming ${agent.dreamingEnabled ? 'daily' : 'off'}`}
                </Badge>
              </div>
              <h1 className="text-pretty font-black font-serif text-4xl uppercase leading-[0.9] tracking-tighter sm:text-5xl lg:text-6xl xl:text-7xl">
                {agent.name}
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 xl:justify-end">
            <TriggerButton
              agentId={agent.id}
              label="Trigger now"
              variant="outline"
            />
            <TriggerButton
              agentId={agent.id}
              label="Dream"
              mode="dreaming"
              variant="outline"
            />
            <Button asChild size="sm" variant="default">
              <Link href={`/agents/${agent.id}/configure`}>Configure</Link>
            </Button>
          </div>
        </div>
      </header>

      <nav
        aria-label="Agent workspace"
        className="sticky top-14 z-20 mt-8 flex overflow-x-auto border-foreground border-y-2 bg-background lg:top-12"
      >
        {WORKSPACE_TABS.map((tab) => {
          const href = tabHref(agent.id, tab.key)
          const active = isTabActive(pathname, agent.id, tab.key)
          return (
            <Link
              aria-current={active ? 'page' : undefined}
              className={cn(
                'inline-flex h-12 shrink-0 items-center gap-2 border-foreground border-r-2 px-4 font-bold text-xs uppercase tracking-[0.16em] transition-colors last:border-r-0 hover:bg-accent hover:text-foreground',
                active
                  ? 'bg-foreground text-background hover:bg-foreground hover:text-background'
                  : 'text-muted-foreground'
              )}
              href={href}
              key={tab.key}
            >
              <tab.icon aria-hidden className="size-4" />
              {tab.label}
            </Link>
          )
        })}
      </nav>
    </>
  )
}

function tabHref(agentId: string, key: (typeof WORKSPACE_TABS)[number]['key']) {
  switch (key) {
    case 'overview':
      return `/agents/${agentId}`
    case 'chat':
      return `/agents/${agentId}/chat`
    case 'events':
      return `/agents/${agentId}/events`
    case 'configure':
      return `/agents/${agentId}/configure`
    case 'tools':
      return `/agents/${agentId}/tools`
    case 'memory':
      return `/agents/${agentId}/memory`
    default:
      return `/agents/${agentId}`
  }
}

function isTabActive(
  pathname: string | null,
  agentId: string,
  key: (typeof WORKSPACE_TABS)[number]['key']
): boolean {
  if (!pathname) {
    return false
  }
  const root = `/agents/${agentId}`
  if (key === 'overview') {
    return pathname === root || pathname === `${root}/about`
  }
  if (key === 'configure') {
    return (
      pathname.startsWith(`${root}/configure`) ||
      pathname.startsWith(`${root}/edit`)
    )
  }
  if (key === 'memory') {
    return (
      pathname.startsWith(`${root}/memory`) ||
      pathname.startsWith(`${root}/files`) ||
      pathname.startsWith(`${root}/timeline`) ||
      pathname.startsWith(`${root}/dreams`)
    )
  }
  return pathname.startsWith(`${root}/${key}`)
}
