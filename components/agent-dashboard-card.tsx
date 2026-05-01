'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  type AgentActivityEvent,
  useAgentActivityPreview,
  useAgentActivityStream,
} from '@/hooks/use-agent-activity-stream'
import { cn } from '@/lib/utils'

export interface DashboardAgent {
  enabled: boolean
  heartbeatEnabled: boolean
  heartbeatIntervalMinutes: number
  id: string
  lastHeartbeatAt: string | null
  lastReflectionAt: string | null
  lastSessionRunId: string | null
  model: string
  name: string
  reflectionEnabled: boolean
}

export function AgentDashboardCard({ agent }: { agent: DashboardAgent }) {
  const [open, setOpen] = useState(false)
  const stream = useAgentActivityStream({
    agentId: agent.id,
    enabled: agent.enabled,
    sessionRunId: agent.lastSessionRunId,
  })
  const preview = useAgentActivityPreview({
    enabled: agent.enabled,
    lastHeartbeatAt: agent.lastHeartbeatAt,
    lastReflectionAt: agent.lastReflectionAt,
    sessionRunId: agent.lastSessionRunId,
    streamState: stream,
  })
  const status = getStatusLabel(agent, stream.kind)

  return (
    <Collapsible onOpenChange={setOpen} open={open}>
      <article
        className={cn(
          'border-foreground border-b-2 bg-background transition-colors last:border-b-0',
          open ? 'bg-muted/70' : 'hover:bg-accent'
        )}
      >
        <CollapsibleTrigger asChild>
          <button
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
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <AgentActivityPanel agent={agent} stream={stream} />
        </CollapsibleContent>
      </article>
    </Collapsible>
  )
}

function AgentActivityPanel({
  agent,
  stream,
}: {
  agent: DashboardAgent
  stream: ReturnType<typeof useAgentActivityStream>
}) {
  const schedule = useMemo(() => buildSchedule(agent), [agent])

  return (
    <div className="grid gap-6 border-foreground border-t-2 px-0 py-6 md:grid-cols-[minmax(0,1fr)_18rem] md:px-4">
      <section aria-label={`${agent.name} activity stream`}>
        <div className="mb-4 flex items-center justify-between gap-4">
          <p className="font-bold text-[10px] uppercase tracking-[0.2em]">
            Live stream
          </p>
          <p className="text-muted-foreground text-xs">
            {formatStreamState(stream.kind)}
          </p>
        </div>
        <ol className="max-h-80 overflow-y-auto border-foreground border-y-2">
          {stream.events.length > 0 ? (
            stream.events.map((event) => (
              <ActivityEventRow event={event} key={event.id} />
            ))
          ) : (
            <li className="py-6 text-muted-foreground text-sm">
              {getStreamMessage(stream) ??
                'No streamed activity yet. Trigger a heartbeat or chat turn to populate this feed.'}
            </li>
          )}
        </ol>
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
          className="mt-6 inline-flex h-11 items-center justify-center border-2 border-foreground bg-foreground px-4 font-bold text-background text-xs uppercase tracking-[0.16em] transition-colors hover:border-accent hover:bg-accent hover:text-foreground"
          href={`/agents/${agent.id}/chat`}
        >
          Open agent
        </Link>
      </aside>
    </div>
  )
}

function ActivityEventRow({ event }: { event: AgentActivityEvent }) {
  return (
    <li className="grid gap-2 border-foreground border-b py-4 last:border-b-0 md:grid-cols-[7rem_1fr]">
      <time
        className="font-mono text-muted-foreground text-xs"
        dateTime={event.isoTime}
      >
        {event.time}
      </time>
      <div>
        <p className="font-medium text-sm">{event.message}</p>
        <p className="mt-1 text-muted-foreground text-xs uppercase tracking-[0.16em]">
          {event.label}
        </p>
      </div>
    </li>
  )
}

function getStatusLabel(
  agent: DashboardAgent,
  streamKind: ReturnType<typeof useAgentActivityStream>['kind']
): string {
  if (!agent.enabled) {
    return 'paused'
  }
  if (streamKind === 'streaming') {
    return 'live'
  }
  if (agent.lastSessionRunId) {
    return 'session ready'
  }
  return 'idle'
}

function getStreamMessage(
  stream: ReturnType<typeof useAgentActivityStream>
): string | null {
  return 'message' in stream ? stream.message : null
}

function buildSchedule(agent: DashboardAgent) {
  return [
    {
      label: 'Heartbeat',
      value: agent.heartbeatEnabled
        ? `Every ${agent.heartbeatIntervalMinutes} min`
        : 'Off',
    },
    {
      label: 'Last heartbeat',
      value: formatNullableDate(agent.lastHeartbeatAt),
    },
    {
      label: 'Reflection',
      value: agent.reflectionEnabled ? 'On' : 'Off',
    },
    {
      label: 'Last reflection',
      value: formatNullableDate(agent.lastReflectionAt),
    },
  ]
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

function formatStreamState(
  kind: ReturnType<typeof useAgentActivityStream>['kind']
): string {
  switch (kind) {
    case 'connecting':
      return 'connecting'
    case 'streaming':
      return 'receiving events'
    case 'unavailable':
      return 'stream unavailable'
    case 'failed':
      return 'stream failed'
    case 'idle':
      return 'idle'
    default:
      return 'idle'
  }
}
