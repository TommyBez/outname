'use client'

import { readUIMessageStream } from 'ai'
import { useEffect, useState } from 'react'
import type {
  AgentChatChunk,
  AgentChatMessage,
  WorkflowStatusData,
} from '@/agent-runtime/server/chat-status'
import type { RunEvent } from '@/agent-runtime/server/run-events'
import {
  eventSummaryToWorkflowStatus,
  runEventToWorkflowStatus,
  terminalErrorToWorkflowStatus,
} from '@/agent-runtime/shared/event-transcript'
import {
  type AgentEventSummary,
  isTerminalAgentEventStatus,
} from '@/agent-runtime/shared/event-types'
import {
  flushNdjsonBuffer,
  parseNdjsonChunk,
} from '@/agent-runtime/shared/ndjson'

export type AgentEventTranscriptStatus =
  | 'queued'
  | 'connecting'
  | 'streaming'
  | 'completed'
  | 'failed'
  | 'unavailable'

export interface UseAgentEventTranscriptResult {
  error: string | null
  messages: AgentChatMessage[]
  status: AgentEventTranscriptStatus
  workflowStatus: WorkflowStatusData | null
}

export function useAgentEventTranscript(input: {
  agentId: string
  event: AgentEventSummary | null
}): UseAgentEventTranscriptResult {
  const { agentId, event } = input
  const eventAttempt = event?.attempt ?? null
  const eventBlockedByEventId = event?.blockedByEventId ?? null
  const eventCompletedAt = event?.completedAt ?? null
  const eventId = event?.id ?? null
  const eventLastError = event?.lastError ?? null
  const eventPreview = event?.preview ?? null
  const eventQueuedAt = event?.queuedAt ?? null
  const eventSource = event?.source ?? null
  const eventStartedAt = event?.startedAt ?? null
  const eventStatus = event?.status ?? null
  const eventType = event?.type ?? null
  const eventWorkflowRunId = event?.workflowRunId ?? null
  const [messages, setMessages] = useState<AgentChatMessage[]>([])
  const [status, setStatus] =
    useState<AgentEventTranscriptStatus>('unavailable')
  const [error, setError] = useState<string | null>(null)
  const [workflowStatus, setWorkflowStatus] =
    useState<WorkflowStatusData | null>(null)

  useEffect(() => {
    if (
      !(
        eventId &&
        eventQueuedAt &&
        eventSource &&
        eventStatus &&
        eventType &&
        eventAttempt !== null
      )
    ) {
      setMessages([])
      setStatus('unavailable')
      setError(null)
      setWorkflowStatus(null)
      return
    }
    const currentEvent: AgentEventSummary = {
      attempt: eventAttempt,
      blockedByEventId: eventBlockedByEventId,
      completedAt: eventCompletedAt,
      id: eventId,
      lastError: eventLastError,
      preview: eventPreview,
      queuedAt: eventQueuedAt,
      source: eventSource,
      startedAt: eventStartedAt,
      status: eventStatus,
      type: eventType,
      workflowRunId: eventWorkflowRunId,
    }

    const controller = new AbortController()
    setMessages([])
    setError(null)
    setWorkflowStatus(eventSummaryToWorkflowStatus(currentEvent))

    if (!currentEvent.workflowRunId) {
      setStatus(statusForEventWithoutRun(currentEvent))
      return () => controller.abort()
    }

    setStatus('connecting')

    const outputPromise = consumeOutputStream({
      agentId,
      eventId: currentEvent.id,
      signal: controller.signal,
      onMessage: (message) => {
        if (!controller.signal.aborted) {
          setStatus('streaming')
          setWorkflowStatus(null)
          setMessages((current) => upsertMessage(current, message))
        }
      },
    })

    const activityPromise = consumeActivityStream({
      agentId,
      eventId: currentEvent.id,
      signal: controller.signal,
      onEvent: (runEvent) => {
        if (!controller.signal.aborted) {
          setStatus('streaming')
          setWorkflowStatus(runEventToWorkflowStatus(runEvent))
        }
      },
    })

    let active = true

    const settleStreams = async (): Promise<void> => {
      const results = await Promise.allSettled([outputPromise, activityPromise])
      if (!(active && !controller.signal.aborted)) {
        return
      }

      const rejected = results.find(
        (result): result is PromiseRejectedResult =>
          result.status === 'rejected'
      )
      if (rejected) {
        const reason = rejected.reason
        if (reason instanceof StreamPendingError) {
          setStatus(statusForEventWithoutRun(currentEvent))
          setWorkflowStatus(eventSummaryToWorkflowStatus(currentEvent))
          return
        }
        const message = readErrorMessage(reason)
        setError(message)
        setStatus('failed')
        setWorkflowStatus(terminalErrorToWorkflowStatus(message))
        return
      }

      setStatus(statusForTerminalEvent(currentEvent))
      setWorkflowStatus(eventSummaryToWorkflowStatus(currentEvent))
    }

    settleStreams().catch((reason: unknown) => {
      if (!(active && !controller.signal.aborted)) {
        return
      }
      const message = readErrorMessage(reason)
      setError(message)
      setStatus('failed')
      setWorkflowStatus(terminalErrorToWorkflowStatus(message))
    })

    return () => {
      active = false
      controller.abort()
    }
  }, [
    agentId,
    eventAttempt,
    eventBlockedByEventId,
    eventCompletedAt,
    eventId,
    eventLastError,
    eventPreview,
    eventQueuedAt,
    eventSource,
    eventStartedAt,
    eventStatus,
    eventType,
    eventWorkflowRunId,
  ])

  return { error, messages, status, workflowStatus }
}

async function consumeOutputStream(input: {
  agentId: string
  eventId: string
  onMessage: (message: AgentChatMessage) => void
  signal: AbortSignal
}): Promise<void> {
  const stream = await openEventStream<AgentChatChunk>({
    agentId: input.agentId,
    eventId: input.eventId,
    signal: input.signal,
    stream: 'output',
  })
  for await (const message of readUIMessageStream<AgentChatMessage>({
    stream,
    terminateOnError: false,
  })) {
    input.onMessage(message)
  }
}

async function consumeActivityStream(input: {
  agentId: string
  eventId: string
  onEvent: (event: RunEvent) => void
  signal: AbortSignal
}): Promise<void> {
  const stream = await openEventStream<RunEvent>({
    agentId: input.agentId,
    eventId: input.eventId,
    signal: input.signal,
    stream: 'activity',
  })
  const reader = stream.getReader()
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) {
        return
      }
      input.onEvent(value)
    }
  } finally {
    reader.releaseLock()
  }
}

async function openEventStream<T>(input: {
  agentId: string
  eventId: string
  signal: AbortSignal
  stream: 'activity' | 'output'
}): Promise<ReadableStream<T>> {
  const response = await fetch(
    `/api/agents/${input.agentId}/events/${input.eventId}/stream?stream=${input.stream}`,
    {
      cache: 'no-store',
      signal: input.signal,
    }
  )
  if (response.status === 409) {
    throw new StreamPendingError()
  }
  if (!response.ok) {
    throw new Error(`Event stream failed with HTTP ${response.status}`)
  }
  if (!response.body) {
    throw new Error('Event stream did not return a body')
  }
  return ndjsonReadable<T>(response.body)
}

function ndjsonReadable<T>(
  body: ReadableStream<Uint8Array>
): ReadableStream<T> {
  return new ReadableStream<T>({
    async start(controller) {
      const reader = body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) {
            break
          }
          const parsed = parseNdjsonChunk<T>(
            buffer,
            decoder.decode(value, { stream: true })
          )
          buffer = parsed.buffer
          for (const item of parsed.values) {
            controller.enqueue(item)
          }
        }
        const tail = decoder.decode()
        if (tail.length > 0) {
          const parsed = parseNdjsonChunk<T>(buffer, tail)
          buffer = parsed.buffer
          for (const item of parsed.values) {
            controller.enqueue(item)
          }
        }
        for (const item of flushNdjsonBuffer<T>(buffer)) {
          controller.enqueue(item)
        }
        controller.close()
      } catch (err) {
        controller.error(err)
      } finally {
        reader.releaseLock()
      }
    },
  })
}

function upsertMessage(
  messages: AgentChatMessage[],
  message: AgentChatMessage
): AgentChatMessage[] {
  const index = messages.findIndex((item) => item.id === message.id)
  if (index < 0) {
    return [...messages, message]
  }
  const next = messages.slice()
  next[index] = message
  return next
}

function statusForEventWithoutRun(
  event: AgentEventSummary
): AgentEventTranscriptStatus {
  if (event.status === 'failed') {
    return 'failed'
  }
  if (isTerminalAgentEventStatus(event.status)) {
    return 'unavailable'
  }
  return 'queued'
}

function statusForTerminalEvent(
  event: AgentEventSummary
): AgentEventTranscriptStatus {
  if (event.status === 'failed') {
    return 'failed'
  }
  if (event.status === 'queued' || event.status === 'starting') {
    return 'queued'
  }
  if (event.status === 'running') {
    return 'streaming'
  }
  return 'completed'
}

function readErrorMessage(reason: unknown): string {
  if (reason instanceof Error) {
    return reason.message
  }
  return 'Event transcript is unavailable.'
}

class StreamPendingError extends Error {
  constructor() {
    super('Event stream is not ready yet.')
    this.name = 'StreamPendingError'
  }
}
