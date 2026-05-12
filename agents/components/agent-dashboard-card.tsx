'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import {
  type AgentRunTranscriptState,
  useAgentRunTranscript,
  useAgentRunTranscriptPreview,
} from '@/agent-runtime/hooks/use-agent-run-transcript'
import { formatAgentCadence } from '@/agents/format'
import { BudgetIndicator } from '@/budgets/components/budget-indicator'
import type { BudgetSummaryEntry } from '@/budgets/server/types'
import { AgentChatTranscript } from '@/chat/components/agent-chat-transcript'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
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

export function AgentDashboardCard({
  agent,
  budgetEntries,
}: {
  agent: DashboardAgent
  budgetEntries?: BudgetSummaryEntry[]
}) {
  const [open, setOpen] = useState(false)
  const transcript = useAgentRunTranscript({
    agentId: agent.id,
    enabled: agent.enabled && open,
    sessionRunId: agent.lastSessionRunId,
  })
  const preview = useAgentRunTranscriptPreview({
    enabled: agent.enabled,
    lastHeartbeatAt: agent.lastHeartbeatAt,
    lastReflectionAt: agent.lastReflectionAt,
    sessionRunId: agent.lastSessionRunId,
    streamState: transcript,
  })
  const status = getStatusLabel(agent, transcript.kind)
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
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <AgentActivityPanel agent={agent} transcript={transcript} />
        </CollapsibleContent>
      </article>
    </Collapsible>
  )
}

function AgentActivityPanel({
  agent,
  transcript,
}: {
  agent: DashboardAgent
  transcript: AgentRunTranscriptState
}) {
  const schedule = useMemo(() => buildSchedule(agent), [agent])

  return (
    <div className="grid gap-6 border-foreground border-t-2 px-0 py-6 md:grid-cols-[minmax(0,1fr)_18rem] md:px-4">
      <section
        aria-label={`${agent.name} run monitor`}
        className="min-h-0 min-w-0"
      >
        <div className="mb-4 flex items-center justify-between gap-4">
          <p className="font-bold text-[10px] uppercase tracking-[0.2em]">
            Run monitor
          </p>
          <p className="text-muted-foreground text-xs">
            {formatTranscriptState(transcript.kind)}
          </p>
        </div>
        <div className="h-128 min-h-0 overflow-hidden border-foreground border-y-2 bg-background">
          <AgentChatTranscript
            className="h-full"
            emptyDescription={
              getTranscriptMessage(transcript) ??
              'Trigger a heartbeat or dream run to populate this read-only run monitor.'
            }
            emptyTitle="No run transcript yet"
            messages={transcript.messages}
          />
        </div>
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
          Open chat
        </Link>
      </aside>
    </div>
  )
}

function getStatusLabel(
  agent: DashboardAgent,
  transcriptKind: AgentRunTranscriptState['kind']
): string {
  if (!agent.enabled) {
    return 'paused'
  }
  if (transcriptKind === 'streaming') {
    return 'live'
  }
  if (agent.lastSessionRunId) {
    return 'session ready'
  }
  return 'idle'
}

function getTranscriptMessage(
  transcript: AgentRunTranscriptState
): string | null {
  return 'message' in transcript ? transcript.message : null
}

function buildSchedule(agent: DashboardAgent) {
  return [
    {
      label: 'Heartbeat',
      value: agent.heartbeatEnabled
        ? formatAgentCadence(agent.heartbeatIntervalMinutes)
        : 'Off',
    },
    {
      label: 'Last heartbeat',
      value: formatNullableDate(agent.lastHeartbeatAt),
    },
    {
      label: 'Dreaming',
      value: agent.reflectionEnabled ? 'On' : 'Off',
    },
    {
      label: 'Last dream',
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

function formatTranscriptState(kind: AgentRunTranscriptState['kind']): string {
  switch (kind) {
    case 'connecting':
      return 'connecting'
    case 'streaming':
      return 'receiving transcript'
    case 'unavailable':
      return 'transcript unavailable'
    case 'failed':
      return 'transcript failed'
    case 'idle':
      return 'idle'
    default:
      return 'idle'
  }
}
