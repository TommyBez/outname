'use client'

import {
  Activity,
  CheckCircle2,
  CircleDashed,
  Clock3,
  Loader2,
  XCircle,
} from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { useAgentEventTranscript } from '@/agent-runtime/hooks/use-agent-event-transcript'
import { sortAgentEvents } from '@/agent-runtime/shared/compact-ledger-events'
import {
  type AgentEventStatus,
  type AgentEventSummary,
  type AgentEventsListResponse,
  formatAgentEventSourceLabel,
  formatAgentEventTypeLabel,
  isTerminalAgentEventStatus,
} from '@/agent-runtime/shared/event-types'
import { AgentChatTranscript } from '@/chat/components/agent-chat-transcript'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface AgentEventsWorkspaceProps {
  agentId: string
  initialEvents: AgentEventSummary[]
}

export function AgentEventsWorkspace({
  agentId,
  initialEvents,
}: AgentEventsWorkspaceProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryEventId = searchParams.get('event')
  const [events, setEvents] = useState<AgentEventSummary[]>(initialEvents)
  const [ledgerStale, setLedgerStale] = useState(false)
  const pollMs = useMemo(() => (hasLiveEvents(events) ? 2500 : 6000), [events])
  const sortedEvents = useMemo(() => sortAgentEvents(events), [events])
  const ledgerEvents = sortedEvents
  const selectedEvent =
    sortedEvents.find((event) => event.id === queryEventId) ??
    pickDefaultEvent(ledgerEvents)
  const transcript = useAgentEventTranscript({
    agentId,
    event: selectedEvent ?? null,
  })

  useEffect(() => {
    let cancelled = false

    async function refreshEvents() {
      try {
        const response = await fetch(`/api/agents/${agentId}/events?limit=50`, {
          cache: 'no-store',
        })
        if (!response.ok) {
          if (!cancelled) {
            setLedgerStale(true)
          }
          return
        }
        const body = (await response.json()) as AgentEventsListResponse
        if (!cancelled) {
          setEvents(body.events)
          setLedgerStale(false)
        }
      } catch {
        if (!cancelled) {
          setLedgerStale(true)
        }
      }
    }

    refreshEvents().catch(() => undefined)
    const interval = window.setInterval(refreshEvents, pollMs)
    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [agentId, pollMs])

  function selectEvent(eventId: string) {
    router.replace(`/agents/${agentId}/events?event=${eventId}`, {
      scroll: false,
    })
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[24rem_minmax(0,1fr)]">
      <aside className="flex h-[min(42rem,calc(100svh-12rem))] min-h-[20rem] min-w-0 flex-col overflow-hidden border-2 border-foreground bg-background xl:h-[42rem]">
        <div className="flex shrink-0 items-center justify-between gap-4 border-foreground border-b-2 px-4 py-3">
          <div>
            <p className="font-bold text-[10px] text-muted-foreground uppercase tracking-[0.18em]">
              Event ledger
            </p>
            <h2 className="mt-1 font-black font-serif text-2xl uppercase leading-none tracking-tighter">
              Events
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {ledgerStale && (
              <span className="font-bold text-[10px] text-amber-600 uppercase tracking-[0.14em]">
                Stale
              </span>
            )}
            <Badge variant="outline">{ledgerEvents.length}</Badge>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {ledgerEvents.length === 0 ? (
            <div className="px-4 py-8 text-muted-foreground text-sm">
              No non-chat events recorded yet.
            </div>
          ) : (
            <ul className="divide-y-2 divide-foreground">
              {ledgerEvents.map((event) => (
                <li key={event.id}>
                  <button
                    aria-pressed={selectedEvent?.id === event.id}
                    className={cn(
                      'grid w-full gap-3 px-4 py-4 text-left transition-colors hover:bg-accent',
                      selectedEvent?.id === event.id &&
                        'bg-foreground text-background hover:bg-foreground hover:text-background'
                    )}
                    onClick={() => selectEvent(event.id)}
                    type="button"
                  >
                    <span className="flex min-w-0 items-center justify-between gap-3">
                      <span className="inline-flex min-w-0 items-center gap-2">
                        <EventStatusIcon status={event.status} />
                        <span className="truncate font-bold text-xs uppercase tracking-[0.14em]">
                          {formatEventLabel(event)}
                        </span>
                      </span>
                      <EventStatusBadge status={event.status} />
                    </span>
                    {event.preview && (
                      <span className="line-clamp-2 text-sm leading-5">
                        {event.preview}
                      </span>
                    )}
                    <span
                      className={cn(
                        'font-mono text-[11px]',
                        selectedEvent?.id === event.id
                          ? 'text-background/70'
                          : 'text-muted-foreground'
                      )}
                    >
                      {formatDate(event.queuedAt)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>

      <section className="flex h-[min(42rem,calc(100svh-10rem))] min-h-[24rem] min-w-0 flex-col border-2 border-foreground bg-background xl:h-[42rem]">
        <EventTranscriptHeader
          event={selectedEvent ?? null}
          onSelectEvent={selectEvent}
          streamStatus={transcript.status}
        />
        <AgentChatTranscript
          className="min-h-0"
          emptyDescription="Event activity will appear here when the workflow starts."
          emptyTitle="Waiting for transcript"
          messages={transcript.messages}
          workflowStatus={transcript.workflowStatus}
        />
        {transcript.warning && !transcript.error && (
          <p
            className="mx-4 mb-2 border-2 border-amber-500 bg-amber-500/10 px-3 py-2 font-bold text-amber-800 text-xs uppercase tracking-[0.12em] dark:text-amber-200"
            role="status"
          >
            {transcript.warning}
          </p>
        )}
        {transcript.error && (
          <p
            className="mx-4 mb-4 border-2 border-destructive bg-destructive/10 px-3 py-2 font-bold text-destructive text-xs uppercase tracking-[0.12em]"
            role="alert"
          >
            {transcript.error}
          </p>
        )}
      </section>
    </div>
  )
}

function EventTranscriptHeader({
  event,
  onSelectEvent,
  streamStatus,
}: {
  event: AgentEventSummary | null
  onSelectEvent: (eventId: string) => void
  streamStatus: string
}) {
  const blockedByEventId = event?.blockedByEventId

  return (
    <div className="border-foreground border-b-2 px-4 py-4">
      {event ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <EventStatusBadge status={event.status} />
              <Badge variant="outline">{event.source}</Badge>
              <Badge variant="secondary">{streamStatus}</Badge>
            </div>
            <h2 className="mt-3 truncate font-black font-serif text-3xl uppercase leading-none tracking-tighter">
              {formatEventLabel(event)}
            </h2>
          </div>
          <div className="text-right font-mono text-muted-foreground text-xs">
            <p>{formatDate(event.queuedAt)}</p>
            {event.startedAt && <p>started {formatTime(event.startedAt)}</p>}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 text-muted-foreground">
          <Activity aria-hidden className="size-5" />
          <span className="font-bold text-xs uppercase tracking-[0.16em]">
            No event selected
          </span>
        </div>
      )}
      {blockedByEventId && (
        <button
          className="mt-4 border-2 border-foreground px-3 py-2 font-bold text-xs uppercase tracking-[0.14em] transition-colors hover:bg-accent"
          onClick={() => onSelectEvent(blockedByEventId)}
          type="button"
        >
          Open active event
        </button>
      )}
    </div>
  )
}

function EventStatusBadge({ status }: { status: AgentEventStatus }) {
  return (
    <Badge
      className={cn(
        status === 'failed' && 'border-destructive bg-destructive text-white',
        status === 'completed' && 'border-foreground bg-foreground text-white',
        status === 'running' && 'bg-primary text-primary-foreground'
      )}
      variant={
        status === 'queued' || status === 'starting' ? 'outline' : 'secondary'
      }
    >
      {status}
    </Badge>
  )
}

function EventStatusIcon({ status }: { status: AgentEventStatus }) {
  const className = 'size-4 shrink-0'
  switch (status) {
    case 'completed':
      return <CheckCircle2 aria-hidden className={className} />
    case 'failed':
    case 'cancelled':
      return <XCircle aria-hidden className={className} />
    case 'running':
      return <Loader2 aria-hidden className={cn(className, 'animate-spin')} />
    case 'starting':
      return <CircleDashed aria-hidden className={className} />
    case 'queued':
      return <Clock3 aria-hidden className={className} />
    default: {
      const exhaustive: never = status
      return exhaustive
    }
  }
}

function hasLiveEvents(events: readonly AgentEventSummary[]): boolean {
  return events.some((event) => !isTerminalAgentEventStatus(event.status))
}

function pickDefaultEvent(
  events: readonly AgentEventSummary[]
): AgentEventSummary | null {
  return (
    events.find((event) => event.status === 'running') ??
    events.find((event) => event.status === 'starting') ??
    events.find((event) => event.status === 'queued') ??
    events[0] ??
    null
  )
}

function formatEventLabel(event: AgentEventSummary): string {
  const type = formatAgentEventTypeLabel(event.type)
  const source = formatAgentEventSourceLabel(event.source)
  return type === source ? type : `${type} / ${source}`
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
  }).format(new Date(value))
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(value))
}
