'use client'

import {
  type AgentEventSummary,
  type AgentEventType,
  formatAgentEventSourceLabel,
  formatAgentEventTypeLabel,
  isTerminalAgentEventStatus,
} from '@outname/ai/agent-runtime/shared/event-types'
import type { AgentScheduleMode } from '@outname/shared/agent-schedule'
import { TriggerButton } from '@outname/shared/agents/components/trigger-button'
import { formatAgentSchedule } from '@outname/shared/agents/format'
import { BudgetIndicator } from '@outname/shared/budgets/components/budget-indicator'
import type { BudgetSummaryEntry } from '@outname/shared/budgets/server/types'
import { formatMediumDateTimeInTimeZone } from '@outname/shared/format-timezone'
import { Button } from '@outname/ui/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@outname/ui/components/ui/collapsible'
import { cn } from '@outname/ui/lib/utils'
import Link from 'next/link'
import { useMemo, useState } from 'react'

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
  timeZone,
}: {
  agent: DashboardAgent
  budgetEntries?: BudgetSummaryEntry[]
  eventSummaries?: AgentEventSummary[]
  timeZone: string
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
          'border-border border-b bg-background transition-colors last:border-b-0',
          open ? 'bg-muted/70' : 'hover:bg-accent'
        )}
      >
        <CollapsibleTrigger asChild>
          <Button
            aria-label={`${open ? 'Collapse' : 'Expand'} ${agent.name} activity`}
            className="group grid h-auto w-full items-stretch justify-normal gap-6 border-0 bg-transparent px-0 py-8 text-left font-normal normal-case tracking-normal outline-none transition-colors hover:bg-transparent focus-visible:bg-accent focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background md:grid-cols-[minmax(0,7fr)_minmax(16rem,3fr)] md:px-4"
            size="xs"
            type="button"
            variant="ghost"
          >
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-x-3 gap-y-1 font-bold text-[10px] text-muted-foreground group-hover:text-foreground">
                <span>{agent.model}</span>
                <span>{status}</span>
                {!agent.enabled && (
                  <span className="border border-border px-1.5 py-0.5 text-[10px] tracking-wider">
                    paused
                  </span>
                )}
              </p>
              <h2 className="mt-2 text-pretty font-semibold font-serif text-4xl leading-[0.95] tracking-tighter md:text-5xl">
                {agent.name}
              </h2>
              {entries.length > 0 && (
                <div className="mt-4">
                  <BudgetIndicator entries={entries} variant="agent" />
                </div>
              )}
            </div>

            <div className="flex items-end justify-between gap-6 border-border border-t pt-5 md:border-t-0 md:border-l md:pl-6">
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
            timeZone={timeZone}
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
  timeZone,
}: {
  agent: DashboardAgent
  budgetEntries: BudgetSummaryEntry[]
  eventSummaries: AgentEventSummary[]
  timeZone: string
}) {
  const schedule = useMemo(
    () => buildSchedule(agent, timeZone),
    [agent, timeZone]
  )
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
    <div className="grid gap-6 border-border border-t px-0 py-6 md:grid-cols-[minmax(0,1fr)_18rem] md:px-4">
      <section
        aria-label={`${agent.name} event monitor`}
        className="min-h-0 min-w-0"
      >
        <div className="mb-4 flex items-center justify-between gap-4">
          <p className="font-bold text-[10px]">Event state</p>
          <Link
            className="font-bold text-[10px] text-muted-foreground hover:text-foreground"
            href={`/agents/${agent.id}/events`}
          >
            Open events →
          </Link>
        </div>
        <EventStateList agentId={agent.id} events={activeEvents} />
        <LatestWorkList agentId={agent.id} events={latestWork} />
        <AttentionList items={attentionItems} />
      </section>

      <aside className="border-border border-t pt-5 md:border-t-0 md:border-l md:pl-6">
        <p className="font-bold text-[10px]">Agent controls</p>
        <dl className="mt-5 grid gap-4 text-sm">
          {schedule.map((item) => (
            <div key={item.label}>
              <dt className="text-muted-foreground text-xs">{item.label}</dt>
              <dd className="mt-1 font-medium">{item.value}</dd>
            </div>
          ))}
        </dl>
        <Link
          className="mt-6 inline-flex h-11 w-full items-center justify-center border border-border bg-foreground px-4 font-bold text-background text-xs transition-colors hover:border-brand hover:bg-brand hover:text-brand-foreground"
          href={`/agents/${agent.id}/events`}
        >
          Open events
        </Link>
        <Link
          className="mt-2 inline-flex h-11 w-full items-center justify-center border border-border px-4 font-bold text-xs transition-colors hover:bg-accent"
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

type DashboardEventType = AgentEventType

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
      <section className="border-border border-y bg-background px-4 py-5">
        <p className="font-bold text-xs">Idle</p>
        <p className="mt-2 text-muted-foreground text-sm">
          No active or queued events.
        </p>
      </section>
    )
  }

  return (
    <section className="border-border border-y bg-background">
      <ul className="divide-y-2 divide-foreground">
        {events.map((event) => (
          <li key={event.id}>
            <Link
              className="grid gap-2 p-4 transition-colors hover:bg-accent sm:grid-cols-[8rem_1fr_auto]"
              href={eventHref(agentId, event.id)}
            >
              <span className="font-bold text-xs">{event.status}</span>
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
      <p className="mb-3 font-bold text-[10px]">Latest work</p>
      <div className="border-border border-y bg-background">
        {WORK_EVENT_TYPES.map((type) => {
          const event = events.get(type)
          return event ? (
            <Link
              className="grid gap-2 border-border border-b px-4 py-3 transition-colors last:border-b-0 hover:bg-accent sm:grid-cols-[8rem_1fr_auto]"
              href={eventHref(agentId, event.id)}
              key={type}
            >
              <span className="font-bold text-xs">
                {formatAgentEventTypeLabel(type)}
              </span>
              <span className="text-sm">{event.status}</span>
              <span className="font-mono text-muted-foreground text-xs">
                {formatRelativeTime(event.completedAt ?? event.queuedAt)}
              </span>
            </Link>
          ) : (
            <div
              className="grid gap-2 border-border border-b px-4 py-3 last:border-b-0 sm:grid-cols-[8rem_1fr_auto]"
              key={type}
            >
              <span className="font-bold text-xs">
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
      <p className="mb-3 font-bold text-[10px]">Attention</p>
      {items.length === 0 ? (
        <div className="border-border border-y bg-background p-4">
          <p className="font-medium text-sm">No recent failures.</p>
          <p className="mt-1 text-muted-foreground text-sm">Budget ok.</p>
        </div>
      ) : (
        <ul className="border-border border-y bg-background">
          {items.map((item) => (
            <li
              className="border-border border-b last:border-b-0"
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
      <p className="font-bold text-xs">{item.label}</p>
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

function buildSchedule(agent: DashboardAgent, timeZone: string) {
  return [
    {
      label: 'Heartbeat',
      value: formatAgentSchedule({
        enabled: agent.heartbeatEnabled,
        intervalMinutes: agent.heartbeatIntervalMinutes,
        mode: agent.heartbeatScheduleMode,
        timeZone,
        times: agent.heartbeatScheduleTimes,
      }),
    },
    {
      label: 'Last heartbeat',
      value: formatNullableAgentTimestamp(agent.lastHeartbeatAt, timeZone),
    },
    {
      label: 'Dreaming',
      value: agent.dreamingEnabled ? 'Daily' : 'Off',
    },
    {
      label: 'Last dream',
      value: formatNullableAgentTimestamp(agent.lastDreamingAt, timeZone),
    },
  ]
}

function latestActiveEvents(
  events: readonly AgentEventSummary[]
): AgentEventSummary[] {
  return operationalEvents(events)
    .filter((event) => !isTerminalAgentEventStatus(event.status))
    .sort(compareOperationalEvents)
}

function latestTerminalEventsByType(
  events: readonly AgentEventSummary[]
): Map<DashboardEventType, AgentEventSummary> {
  const latest = new Map<DashboardEventType, AgentEventSummary>()
  const terminalEvents = operationalEvents(events)
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

  const latestFailure = latestFailedEvent(input.eventSummaries)
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

function operationalEvents(
  events: readonly AgentEventSummary[]
): Array<AgentEventSummary & { type: DashboardEventType }> {
  return events as Array<AgentEventSummary & { type: DashboardEventType }>
}

function latestFailedEvent(
  events: readonly AgentEventSummary[]
): AgentEventSummary | undefined {
  let latestFailure: AgentEventSummary | undefined
  for (const event of operationalEvents(events)) {
    if (event.status !== 'failed') {
      continue
    }
    if (
      !latestFailure ||
      eventTime(event).getTime() > eventTime(latestFailure).getTime()
    ) {
      latestFailure = event
    }
  }
  return latestFailure
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

function formatNullableAgentTimestamp(
  value: string | null,
  timeZone: string
): string {
  if (!value) {
    return 'Never'
  }
  return formatMediumDateTimeInTimeZone(value, timeZone)
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
  const latestFailure = latestFailedEvent(events)
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
