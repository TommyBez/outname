'use client'

import { useAgentEventTranscript } from '@outname/ai/agent-runtime/hooks/use-agent-event-transcript'
import { sortAgentEvents } from '@outname/ai/agent-runtime/shared/compact-ledger-events'
import {
  type AgentEventStatus,
  type AgentEventSummary,
  type AgentEventsListResponse,
  formatAgentEventSourceLabel,
  formatAgentEventTypeLabel,
  isTerminalAgentEventStatus,
} from '@outname/ai/agent-runtime/shared/event-types'
import { AgentChatTranscript } from '@outname/ai/chat/components/agent-chat-transcript'
import {
  formatCompactDateTimeInTimeZone,
  formatTimeInTimeZone,
} from '@outname/shared/format-timezone'
import { Badge } from '@outname/ui/components/ui/badge'
import { Button } from '@outname/ui/components/ui/button'
import { cn } from '@outname/ui/lib/utils'
import {
  Activity,
  CheckCircle2,
  CircleDashed,
  Clock3,
  Loader2,
  XCircle,
} from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useMemo } from 'react'
import useSWR from 'swr'

interface AgentEventsWorkspaceProps {
  agentId: string
  initialEvents: AgentEventSummary[]
  timeZone: string
}

async function fetchAgentEvents(url: string): Promise<AgentEventsListResponse> {
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) {
    throw new Error('Unable to refresh agent events.')
  }
  return (await response.json()) as AgentEventsListResponse
}

export function AgentEventsWorkspace({
  agentId,
  initialEvents,
  timeZone,
}: AgentEventsWorkspaceProps) {
  return (
    <Suspense fallback={null}>
      <AgentEventsWorkspaceContent
        agentId={agentId}
        initialEvents={initialEvents}
        timeZone={timeZone}
      />
    </Suspense>
  )
}

function AgentEventsWorkspaceContent({
  agentId,
  initialEvents,
  timeZone,
}: AgentEventsWorkspaceProps) {
  const { replace } = useRouter()
  const searchParams = useSearchParams()
  const queryEventId = searchParams.get('event')
  const eventList = useSWR<AgentEventsListResponse>(
    `/api/agents/${agentId}/events?limit=50`,
    fetchAgentEvents,
    {
      fallbackData: { events: initialEvents },
      refreshInterval: (latest) =>
        hasLiveEvents(latest?.events ?? []) ? 2500 : 6000,
    }
  )
  const events = eventList.data?.events ?? initialEvents
  const ledgerStale = Boolean(eventList.error)
  const sortedEvents = useMemo(() => sortAgentEvents(events), [events])
  const ledgerEvents = sortedEvents
  const selectedEvent =
    sortedEvents.find((event) => event.id === queryEventId) ??
    pickDefaultEvent(ledgerEvents)
  const transcript = useAgentEventTranscript({
    agentId,
    event: selectedEvent ?? null,
    onWorkflowUnavailable: () => {
      eventList.mutate().catch(() => undefined)
    },
  })

  function selectEvent(eventId: string) {
    replace(`/agents/${agentId}/events?event=${eventId}`, {
      scroll: false,
    })
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[24rem_minmax(0,1fr)]">
      <aside className="flex h-[min(42rem,calc(100svh-12rem))] min-h-[20rem] min-w-0 flex-col overflow-hidden border border-border bg-background xl:h-[42rem]">
        <div className="flex shrink-0 items-center justify-between gap-4 border-border border-b px-4 py-3">
          <div>
            <p className="font-bold text-[10px] text-muted-foreground">
              Event ledger
            </p>
            <h2 className="mt-1 font-semibold font-serif text-2xl leading-none tracking-tighter">
              Events
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {ledgerStale && (
              <span className="font-bold text-[10px] text-amber-600">
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
                  <Button
                    aria-pressed={selectedEvent?.id === event.id}
                    className={cn(
                      'grid h-auto w-full items-stretch justify-normal gap-3 border-0 p-4 text-left font-normal normal-case tracking-normal transition-colors hover:bg-accent',
                      selectedEvent?.id === event.id &&
                        'bg-foreground text-background hover:bg-foreground hover:text-background'
                    )}
                    onClick={() => selectEvent(event.id)}
                    size="xs"
                    type="button"
                    variant="ghost"
                  >
                    <span className="flex min-w-0 items-center justify-between gap-3">
                      <span className="inline-flex min-w-0 items-center gap-2">
                        <EventStatusIcon status={event.status} />
                        <span className="truncate font-bold text-xs">
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
                      {formatCompactDateTimeInTimeZone(
                        event.queuedAt,
                        timeZone
                      )}
                    </span>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>

      <section className="flex h-[min(42rem,calc(100svh-10rem))] min-h-[24rem] min-w-0 flex-col border border-border bg-background xl:h-[42rem]">
        <EventTranscriptHeader
          event={selectedEvent ?? null}
          onSelectEvent={selectEvent}
          streamStatus={transcript.status}
          timeZone={timeZone}
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
            className="mx-4 mb-2 border border-amber-500 bg-amber-500/10 px-3 py-2 font-bold text-amber-800 text-xs dark:text-amber-200"
            role="status"
          >
            {transcript.warning}
          </p>
        )}
        {transcript.error && (
          <p
            className="mx-4 mb-4 border border-destructive bg-destructive/10 px-3 py-2 font-bold text-destructive text-xs"
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
  timeZone,
}: {
  event: AgentEventSummary | null
  onSelectEvent: (eventId: string) => void
  streamStatus: string
  timeZone: string
}) {
  const blockedByEventId = event?.blockedByEventId

  return (
    <div className="border-border border-b p-4">
      {event ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <EventStatusBadge status={event.status} />
              <Badge variant="outline">{event.source}</Badge>
              <Badge variant="secondary">{streamStatus}</Badge>
            </div>
            <h2 className="mt-3 truncate font-semibold text-xl tracking-tight">
              {formatEventLabel(event)}
            </h2>
          </div>
          <div className="text-right font-mono text-muted-foreground text-xs">
            <p>{formatCompactDateTimeInTimeZone(event.queuedAt, timeZone)}</p>
            {event.startedAt && (
              <p>
                started{' '}
                {formatTimeInTimeZone(event.startedAt, timeZone, {
                  includeSeconds: true,
                })}
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 text-muted-foreground">
          <Activity aria-hidden className="size-5" />
          <span className="font-bold text-xs">No event selected</span>
        </div>
      )}
      {blockedByEventId && (
        <Button
          className="mt-4 border border-border px-3 py-2 font-bold text-xs transition-colors hover:bg-accent"
          onClick={() => onSelectEvent(blockedByEventId)}
          size="xs"
          type="button"
          variant="outline"
        >
          Open active event
        </Button>
      )}
    </div>
  )
}

function EventStatusBadge({ status }: { status: AgentEventStatus }) {
  return (
    <Badge
      className={cn(
        status === 'failed' && 'border-destructive bg-destructive text-white',
        status === 'completed' && 'border-border bg-foreground text-white',
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
