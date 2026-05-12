'use client'

import { useEffect, useState } from 'react'
import type { RunEvent } from '@/agent-runtime/server/run-events'

const MAX_ACTIVITY_EVENTS = 24

export interface AgentActivityEvent {
  id: string
  isoTime: string
  label: string
  message: string
  time: string
}

export type AgentActivityStreamState =
  | { kind: 'idle'; events: AgentActivityEvent[] }
  | { kind: 'connecting'; events: AgentActivityEvent[] }
  | { kind: 'streaming'; events: AgentActivityEvent[] }
  | { kind: 'unavailable'; events: AgentActivityEvent[]; message: string }
  | { kind: 'failed'; events: AgentActivityEvent[]; message: string }

interface StreamErrorBody {
  error?: string
  status?: string
}

export function useAgentActivityStream(input: {
  agentId: string
  enabled: boolean
  sessionRunId: string | null
}): AgentActivityStreamState {
  const { agentId, enabled, sessionRunId } = input
  const [state, setState] = useState<AgentActivityStreamState>({
    events: [],
    kind: 'idle',
  })

  useEffect(() => {
    if (!(enabled && sessionRunId)) {
      setState({
        events: [],
        kind: 'idle',
      })
      return
    }

    const abort = new AbortController()
    const ctx = { cancelled: false }
    setState({ events: [], kind: 'connecting' })

    consumeActivityStream({
      abort,
      agentId,
      ctx,
      setState,
    })

    return () => {
      ctx.cancelled = true
      abort.abort()
    }
  }, [agentId, enabled, sessionRunId])

  return state
}

export function useAgentActivityPreview(input: {
  enabled: boolean
  lastHeartbeatAt: string | null
  lastReflectionAt: string | null
  sessionRunId: string | null
  streamState: AgentActivityStreamState
}): string {
  const {
    enabled,
    lastHeartbeatAt,
    lastReflectionAt,
    sessionRunId,
    streamState,
  } = input
  const latest = streamState.events.at(-1)
  if (latest?.message) {
    return latest.message
  }
  if (streamState.kind === 'connecting') {
    return 'Connecting to live activity stream...'
  }
  if (streamState.kind === 'unavailable' || streamState.kind === 'failed') {
    return streamState.message
  }
  if (!enabled) {
    return 'Paused. Enable this agent to resume activity.'
  }
  if (sessionRunId) {
    return 'Session is running. Waiting for the next activity event.'
  }
  if (lastHeartbeatAt) {
    return `Last heartbeat ${formatRelativeTime(lastHeartbeatAt)}`
  }
  if (lastReflectionAt) {
    return `Last dream ${formatRelativeTime(lastReflectionAt)}`
  }
  return 'No activity streamed yet.'
}

async function consumeActivityStream(input: {
  abort: AbortController
  agentId: string
  ctx: { cancelled: boolean }
  setState: React.Dispatch<React.SetStateAction<AgentActivityStreamState>>
}): Promise<void> {
  const { abort, agentId, ctx, setState } = input
  try {
    const res = await fetch(
      `/api/agents/${encodeURIComponent(agentId)}/activity/stream`,
      {
        signal: abort.signal,
      }
    )
    if (!(res.ok && res.body)) {
      const message = await readStreamError(res)
      if (!ctx.cancelled) {
        setState((prev) => ({
          events: prev.events,
          kind: res.status === 409 ? 'unavailable' : 'failed',
          message,
        }))
      }
      return
    }

    await readNdjson({
      body: res.body,
      ctx,
      onEvent: (event) => {
        if (ctx.cancelled) {
          return
        }
        setState((prev) => ({
          events: [
            ...prev.events,
            toAgentActivityEvent(event, prev.events.length),
          ].slice(-MAX_ACTIVITY_EVENTS),
          kind: 'streaming',
        }))
      },
    })
  } catch (err) {
    if (ctx.cancelled || abort.signal.aborted) {
      return
    }
    setState((prev) => ({
      events: prev.events,
      kind: 'failed',
      message: err instanceof Error ? err.message : 'Activity stream failed',
    }))
  }
}

async function readStreamError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as StreamErrorBody
    return body.error ?? `Activity stream unavailable (${res.status})`
  } catch {
    return `Activity stream unavailable (${res.status})`
  }
}

async function readNdjson(input: {
  body: ReadableStream<Uint8Array>
  ctx: { cancelled: boolean }
  onEvent: (event: RunEvent) => void
}): Promise<void> {
  const reader = input.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (!input.ctx.cancelled) {
    const { done, value } = await reader.read()
    if (done) {
      return
    }
    buffer += decoder.decode(value, { stream: true })
    buffer = drainLines(buffer, input.onEvent)
  }
}

function drainLines(
  buffer: string,
  onEvent: (event: RunEvent) => void
): string {
  let working = buffer
  let nl = working.indexOf('\n')
  while (nl >= 0) {
    const line = working.slice(0, nl).trim()
    working = working.slice(nl + 1)
    nl = working.indexOf('\n')
    if (!line) {
      continue
    }
    try {
      onEvent(JSON.parse(line) as RunEvent)
    } catch {
      // The stream is best-effort; ignore malformed progress lines.
    }
  }
  return working
}

function toAgentActivityEvent(
  event: RunEvent,
  index: number
): AgentActivityEvent {
  const date = new Date(event.ts)
  return {
    id: `${event.ts}-${event.type}-${index}`,
    isoTime: date.toISOString(),
    label: eventLabel(event),
    message: event.message,
    time: new Intl.DateTimeFormat(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(date),
  }
}

function eventLabel(event: RunEvent): string {
  switch (event.type) {
    case 'activity':
      return 'activity'
    case 'run':
      return `run ${event.status}`
    case 'step':
      return `${event.step} ${event.status}`
    default:
      return 'event'
  }
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
