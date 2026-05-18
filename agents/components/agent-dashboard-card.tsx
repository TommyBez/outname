'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import {
  type AgentEventSummary,
  type AgentEventType,
  formatAgentEventSourceLabel,
  formatAgentEventTypeLabel,
  isTerminalAgentEventStatus,
} from '@/agent-runtime/shared/event-types'
import { TriggerButton } from '@/agents/components/trigger-button'
import { formatAgentSchedule } from '@/agents/format'
import { BudgetIndicator } from '@/budgets/components/budget-indicator'
import type { BudgetSummaryEntry } from '@/budgets/server/types'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'
import type { AgentScheduleMode } from '@/shared/agent-schedule'
import { Button } from '@/components/ui/button'

export interface DashboardAgent {
  dreamingEnabled: boolean
  enabled: boolean
  heartbeatEnabled: boolean
  heartbeatIntervalMinutes: number
  heartbeatScheduleMode: AgentScheduleMode
  heartbeatScheduleTimes: string[]
  id: string
  lastDreamingAt: string | null
  lastHeartbeatAt: string | null
  model: string
  name: string
}

export function AgentDashboardCard({
  agent,
  budgetEntries,
  eventSummaries,
}: {
  agent: DashboardAgent
  budgetEntries?: BudgetSummaryEntry[]
  eventSummaries?: AgentEventSummary[]
}) {
  const [open, setOpen] = useState(false)
  const events = eventSummaries ?? []
  const preview = getAgentPreview(agent, events)
  const status = getStatusLabel(agent)
  const entries = budgetEntries ?? []

  return (
    <Collapsible onOpenChange={setOpen} open={open}>
      <article
        className={cn(
          'border-foreground border-b-2 bg-background transition-colors last:border-b-0',
          open ? 'bg-muted/70' : 'hover:bg-accent'
        )}
      >
        <CollapsibleTrigger asChild>
          <Button
            aria-label={`${open ? 'Collapse' : 'Expand'} ${agent.name} activity`}
            className="group grid w-full gap-6 px-0 py-8 text-left outline-none transition-colors focus-visible:bg-accent focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background md:grid-cols-[minmax(0,7fr)_minmax(16rem,3fr)] md:px-4"
            type="button"
          >
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-x-3 gap-y-1 font-bold text-[10px] text-muted-foreground uppercase tracking-[0.2em] group-hover:text-foreground">
                <span>{agent.model}</span>
                <span>{status}</span>
                {!agent.enabled && (
                  <span className="border border-border px-1.5 py-0.5 text-[10px] tracking-wider">
                    paused
                  </span>
                )}
              </p>
              <h2 className="mt-2 text-pretty font-black font-serif text-4xl uppercase leading-[0.95] tracking-tighter md:text-5xl">
                {agent.name}
              </h2>
              {entries.length > 0 && (
                <div className="mt-4">
                  <BudgetIndicator entries={entries} variant="agent" />
                </div>
              )}
            </div>

            <div className="flex items-end justify-between gap-6 border-foreground border-t-2 pt-5 md:border-t-0 md:border-l-2 md:pl-6">
              <p className="line-clamp-2 min-w-0 text-muted-foreground text-sm leading-relaxed group-hover:text-foreground">
                {preview}
              </p>
              <span
                aria-hidden
                className="shrink-0 font-bold text-muted-foreground text-sm transition-transform group-hover:translate-x-1 group-hover:text-foreground"
              >
                {open ? 'Collapse' : 'Expand'} →
              </span>
            </div>
          </Button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <AgentActivityPanel
            agent={agent}
            budgetEntries={entries}
            eventSummaries={events}
          />
        </CollapsibleContent>
      </article>
    </Collapsible>
  )
}

function AgentActivityPanel({
  agent,
  budgetEntries,
  eventSummaries,
}: {
  agent: DashboardAgent
  budgetEntries: BudgetSummaryEntry[]
  eventSummaries: AgentEventSummary[]
}) {
  const schedule = useMemo(() => buildSchedule(agent), [agent])
  const activeEvents = useMemo(
    () => latestActiveEvents(eventSummaries),
    [eventSummaries]
  )
  const latestWork = useMemo(
    () => latestTerminalEventsByType(eventSummaries),
    [eventSummaries]
  )
  const attentionItems = useMemo(
    () => buildAttentionItems({ agent, budgetEntries, eventSummaries }),
    [agent, budgetEntries, eventSummaries]
  )

  return (
    <div className="grid gap-6 border-foreground border-t-2 px-0 py-6 md:grid-cols-[minmax(0,1fr)_18rem] md:px-4">
      <section
        aria-label={`${agent.name} event monitor`}
        className="min-h-0 min-w-0"
      >
        <div className="mb-4 flex items-center justify-between gap-4">
          <p className="font-bold text-[10px] uppercase tracking-[0.2em]">
            Event state
          </p>
          <Link
            className="font-bold text-[10px] text-muted-foreground uppercase tracking-[0.18em] hover:text-foreground"
            href={`/agents/${agent.id}/events`}
          >
            Open events →
          </Link>
        </div>
        <EventStateList agentId={agent.id} events={activeEvents} />
        <LatestWorkList agentId={agent.id} events={latestWork} />
        <AttentionList items={attentionItems} />
      </section>

      <aside className="border-foreground border-t-2 pt-5 md:border-t-0 md:border-l-2 md:pl-6">
        <p className="font-bold text-[10px] uppercase tracking-[0.2em]">
          Agent controls
        </p>
        <dl className="mt-5 grid gap-4 text-sm">
          {schedule.map((item) => (
            <div key={item.label}>
              <dt className="text-muted-foreground text-xs uppercase tracking-[0.16em]">
                {item.label}
              </dt>
              <dd className="mt-1 font-medium">{item.value}</dd>
            </div>
          ))}
        </dl>
        <Link
          className="mt-6 inline-flex h-11 w-full items-center justify-center border-2 border-foreground bg-foreground px-4 font-bold text-background text-xs uppercase tracking-[0.16em] transition-colors hover:border-accent hover:bg-accent hover:text-foreground"
          href={`/agents/${agent.id}/events`}
        >
          Open events
        </Link>
        <Link
          className="mt-2 inline-flex h-11 w-full items-center justify-center border-2 border-foreground px-4 font-bold text-xs uppercase tracking-[0.16em] transition-colors hover:bg-accent"
          href={`/agents/${agent.id}/chat`}
        >
          Open chat
        </Link>
        <div className="mt-2 flex flex-wrap gap-2">
          <TriggerButton
            agentId={agent.id}
            className="flex-1"
            label="Run now"
            variant="outline"
          />
          <TriggerButton
            agentId={agent.id}
            className="flex-1"
            label="Dream"
            mode="dreaming"
            variant="outline"
          />
        </div>
      </aside>
    </div>
  )
}

type DashboardEventType = Exclude<AgentEventType, 'chat'>

interface AttentionItem {
  detail: string
  href?: string
  label: string
  tone: 'default' | 'error' | 'warning'
}

const WORK_EVENT_TYPES = ['heartbeat', 'dreaming', 'invocation'] as const

function EventStateList({
  agentId,
  events,
}: {
  agentId: string
  events: AgentEventSummary[]
}) {
  if (events.length === 0) {
    return (
      <section className="border-foreground border-y-2 bg-background px-4 py-5">
        <p className="font-bold text-xs uppercase tracking-[0.16em]">Idle</p>
        <p className="mt-2 text-muted-foreground text-sm">
          No active or queued non-chat events.
        </p>
      </section>
    )
  }

  return (
    <section className="border-foreground border-y-2 bg-background">
      <ul className="divide-y-2 divide-foreground">
        {events.map((event) => (
          <li key={event.id}>
            <Link
              className="grid gap-2 px-4 py-4 transition-colors hover:bg-accent sm:grid-cols-[8rem_1fr_auto]"
              href={eventHref(agentId, event.id)}
            >
              <span className="font-bold text-xs uppercase tracking-[0.16em]">
                {event.status}
              </span>
              <span className="min-w-0 text-sm">
                {formatEventLabel(event)}
                {event.blockedByEventId ? (
                  <span className="text-muted-foreground">
                    {' '}
                    · queued behind active event
                  </span>
                ) : null}
              </span>
              <span className="font-mono text-muted-foreground text-xs">
                {formatRelativeTime(event.startedAt ?? event.queuedAt)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

function LatestWorkList({
  agentId,
  events,
}: {
  agentId: string
  events: Map<DashboardEventType, AgentEventSummary>
}) {
  return (
    <section className="mt-5">
      <p className="mb-3 font-bold text-[10px] uppercase tracking-[0.2em]">
        Latest work
      </p>
      <div className="border-foreground border-y-2 bg-background">
        {WORK_EVENT_TYPES.map((type) => {
          const event = events.get(type)
          return event ? (
            <Link
              className="grid gap-2 border-foreground border-b-2 px-4 py-3 transition-colors last:border-b-0 hover:bg-accent sm:grid-cols-[8rem_1fr_auto]"
              href={eventHref(agentId, event.id)}
              key={type}
            >
              <span className="font-bold text-xs uppercase tracking-[0.16em]">
                {formatAgentEventTypeLabel(type)}
              </span>
              <span className="text-sm">{event.status}</span>
              <span className="font-mono text-muted-foreground text-xs">
                {formatRelativeTime(event.completedAt ?? event.queuedAt)}
              </span>
            </Link>
          ) : (
            <div
              className="grid gap-2 border-foreground border-b-2 px-4 py-3 last:border-b-0 sm:grid-cols-[8rem_1fr_auto]"
              key={type}
            >
              <span className="font-bold text-xs uppercase tracking-[0.16em]">
                {formatAgentEventTypeLabel(type)}
              </span>
              <span className="text-muted-foreground text-sm">
                No event yet
              </span>
              <span />
            </div>
          )
        })}
      </div>
    </section>
  )
}

function AttentionList({ items }: { items: AttentionItem[] }) {
  return (
    <section className="mt-5">
      <p className="mb-3 font-bold text-[10px] uppercase tracking-[0.2em]">
        Attention
      </p>
      {items.length === 0 ? (
        <div className="border-foreground border-y-2 bg-background px-4 py-4">
          <p className="font-medium text-sm">No recent failures.</p>
          <p className="mt-1 text-muted-foreground text-sm">Budget ok.</p>
        </div>
      ) : (
        <ul className="border-foreground border-y-2 bg-background">
          {items.map((item) => (
            <li
              className="border-foreground border-b-2 last:border-b-0"
              key={item.label}
            >
              <AttentionItemRow item={item} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function AttentionItemRow({ item }: { item: AttentionItem }) {
  const className = cn(
    'block px-4 py-3',
    item.href && 'transition-colors hover:bg-accent',
    item.tone === 'error' && 'text-destructive',
    item.tone === 'warning' && 'text-foreground'
  )
  const content = (
    <>
      <p className="font-bold text-xs uppercase tracking-[0.16em]">
        {item.label}
      </p>
      <p className="mt-1 text-sm">{item.detail}</p>
    </>
  )

  if (item.href) {
    return (
      <Link className={className} href={item.href}>
        {content}
      </Link>
    )
  }

  return <div className={className}>{content}</div>
}

function getStatusLabel(agent: DashboardAgent): string {
  if (!agent.enabled) {
    return 'paused'
  }
  return 'event ready'
}

function buildSchedule(agent: DashboardAgent) {
  return [
    {
      label: 'Heartbeat',
      value: formatAgentSchedule({
        enabled: agent.heartbeatEnabled,
        intervalMinutes: agent.heartbeatIntervalMinutes,
        mode: agent.heartbeatScheduleMode,
        times: agent.heartbeatScheduleTimes,
      }),
    },
    {
      label: 'Last heartbeat',
      value: formatNullableDate(agent.lastHeartbeatAt),
    },
    {
      label: 'Dreaming',
      value: agent.dreamingEnabled ? 'Daily' : 'Off',
    },
    {
      label: 'Last dream',
      value: formatNullableDate(agent.lastDreamingAt),
    },
  ]
}

function latestActiveEvents(
  events: readonly AgentEventSummary[]
): AgentEventSummary[] {
  return nonChatEvents(events)
    .filter((event) => !isTerminalAgentEventStatus(event.status))
    .sort(compareOperationalEvents)
}

function latestTerminalEventsByType(
  events: readonly AgentEventSummary[]
): Map<DashboardEventType, AgentEventSummary> {
  const latest = new Map<DashboardEventType, AgentEventSummary>()
  const terminalEvents = nonChatEvents(events)
    .filter((event) => isTerminalAgentEventStatus(event.status))
    .sort(compareNewestEvents)

  for (const event of terminalEvents) {
    if (!latest.has(event.type)) {
      latest.set(event.type, event)
    }
  }

  return latest
}

function buildAttentionItems(input: {
  agent: DashboardAgent
  budgetEntries: readonly BudgetSummaryEntry[]
  eventSummaries: readonly AgentEventSummary[]
}): AttentionItem[] {
  const items: AttentionItem[] = []

  if (!input.agent.enabled) {
    items.push({
      detail: 'Enable this agent before it can accept new events.',
      label: 'Paused',
      tone: 'warning',
    })
  }

  const latestFailure = nonChatEvents(input.eventSummaries)
    .filter((event) => event.status === 'failed')
    .sort(compareNewestEvents)[0]
  if (latestFailure) {
    items.push({
      detail: `${formatEventLabel(latestFailure)} failed ${formatRelativeTime(
        latestFailure.completedAt ?? latestFailure.queuedAt
      )}`,
      href: eventHref(input.agent.id, latestFailure.id),
      label: 'Recent failure',
      tone: 'error',
    })
  }

  for (const budget of input.budgetEntries) {
    if (!(budget.enabled && budget.limitUsd > 0)) {
      continue
    }
    const ratio = budget.spentUsd / budget.limitUsd
    if (ratio >= 1) {
      items.push({
        detail: `${budget.period} budget exceeded.`,
        href: `/agents/${input.agent.id}/configure#budget`,
        label: 'Budget exceeded',
        tone: 'error',
      })
      continue
    }
    if (ratio >= 0.8) {
      items.push({
        detail: `${budget.period} budget is at ${Math.round(ratio * 100)}%.`,
        href: `/agents/${input.agent.id}/configure#budget`,
        label: 'Budget near limit',
        tone: 'warning',
      })
    }
  }

  return items
}

function nonChatEvents(
  events: readonly AgentEventSummary[]
): Array<AgentEventSummary & { type: DashboardEventType }> {
  return events.filter(
    (event): event is AgentEventSummary & { type: DashboardEventType } =>
      event.type !== 'chat'
  )
}

function compareOperationalEvents(
  first: AgentEventSummary,
  second: AgentEventSummary
): number {
  const statusDelta = statusWeight(first.status) - statusWeight(second.status)
  if (statusDelta !== 0) {
    return statusDelta
  }
  return eventTime(second).getTime() - eventTime(first).getTime()
}

function compareNewestEvents(
  first: AgentEventSummary,
  second: AgentEventSummary
): number {
  return eventTime(second).getTime() - eventTime(first).getTime()
}

function statusWeight(status: AgentEventSummary['status']): number {
  switch (status) {
    case 'running':
      return 0
    case 'starting':
      return 1
    case 'queued':
      return 2
    case 'failed':
      return 3
    case 'completed':
      return 4
    case 'cancelled':
      return 5
    default: {
      const exhaustive: never = status
      return exhaustive
    }
  }
}

function eventHref(agentId: string, eventId: string): string {
  return `/agents/${agentId}/events?event=${eventId}`
}

function formatEventLabel(event: AgentEventSummary): string {
  const type = formatAgentEventTypeLabel(event.type)
  const source = formatAgentEventSourceLabel(event.source)
  return type === source ? type : `${type} / ${source}`
}

function eventTime(event: AgentEventSummary): Date {
  return new Date(event.completedAt ?? event.startedAt ?? event.queuedAt)
}

function formatNullableDate(value: string | null): string {
  if (!value) {
    return 'Never'
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function getAgentPreview(
  agent: DashboardAgent,
  events: readonly AgentEventSummary[]
): string {
  if (!agent.enabled) {
    return 'Paused. Enable this agent to accept new events.'
  }
  const activeEvent = latestActiveEvents(events)[0]
  if (activeEvent) {
    return `${formatEventLabel(activeEvent)} ${activeEvent.status} ${formatRelativeTime(
      activeEvent.startedAt ?? activeEvent.queuedAt
    )}`
  }
  const latestFailure = nonChatEvents(events)
    .filter((event) => event.status === 'failed')
    .sort(compareNewestEvents)[0]
  if (latestFailure) {
    return `${formatEventLabel(latestFailure)} failed ${formatRelativeTime(
      latestFailure.completedAt ?? latestFailure.queuedAt
    )}`
  }
  const latestWork = latestTerminalEventsByType(events)
  for (const type of WORK_EVENT_TYPES) {
    const event = latestWork.get(type)
    if (event) {
      return `${formatEventLabel(event)} ${event.status} ${formatRelativeTime(
        event.completedAt ?? event.queuedAt
      )}`
    }
  }
  if (agent.lastHeartbeatAt) {
    return `Last heartbeat ${formatRelativeTime(agent.lastHeartbeatAt)}`
  }
  if (agent.lastDreamingAt) {
    return `Last dream ${formatRelativeTime(agent.lastDreamingAt)}`
  }
  return 'Ready to enqueue chat, Slack, heartbeat, or dreaming events.'
}

function formatRelativeTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return 'recently'
  }

  const diffMs = Date.now() - date.getTime()
  const diffMinutes = Math.max(0, Math.round(diffMs / 60_000))
  if (diffMinutes < 1) {
    return 'just now'
  }
  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`
  }
  const diffHours = Math.round(diffMinutes / 60)
  if (diffHours < 24) {
    return `${diffHours}h ago`
  }
  const diffDays = Math.round(diffHours / 24)
  return `${diffDays}d ago`
}
