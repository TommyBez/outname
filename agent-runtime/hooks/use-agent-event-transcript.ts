'use client'

import { readUIMessageStream } from 'ai'
import { useEffect, useRef, useState } from 'react'
import {
  applyObservedStreamTerminalStatus,
  backoffMs,
  createObservedStreamTerminalState,
  isEventStreamPendingHttpStatus,
  isEventStreamUnavailableHttpStatus,
  observeRunEventTerminalStatus,
  resolveTranscriptOutcome,
  STREAM_MAX_ATTEMPTS,
  STREAM_PENDING_RETRY_MS,
  shouldRetryAfterStreamEnd,
} from '@/agent-runtime/hooks/agent-event-stream-outcome'
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
import { WORKFLOW_STREAM_UNAVAILABLE_MESSAGE } from '@/agent-runtime/shared/workflow-stream-messages'

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
  warning: string | null
  workflowStatus: WorkflowStatusData | null
}

const NDJSON_OPTIONS = { skipInvalidLines: true } as const

export function useAgentEventTranscript(input: {
  agentId: string
  event: AgentEventSummary | null
  onWorkflowUnavailable?: () => void
}): UseAgentEventTranscriptResult {
  const { agentId, event, onWorkflowUnavailable } = input
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
  const [warning, setWarning] = useState<string | null>(null)
  const [workflowStatus, setWorkflowStatus] =
    useState<WorkflowStatusData | null>(null)
  const latestActivityRef = useRef<WorkflowStatusData | null>(null)
  const onWorkflowUnavailableRef = useRef(onWorkflowUnavailable)
  onWorkflowUnavailableRef.current = onWorkflowUnavailable

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
      setWarning(null)
      setWorkflowStatus(null)
      latestActivityRef.current = null
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
    setWarning(null)
    latestActivityRef.current = eventSummaryToWorkflowStatus(currentEvent)
    setWorkflowStatus(latestActivityRef.current)

    if (!currentEvent.workflowRunId) {
      setStatus(statusForEventWithoutRun(currentEvent))
      return () => controller.abort()
    }

    if (
      currentEvent.status === 'failed' ||
      currentEvent.status === 'cancelled'
    ) {
      setStatus(currentEvent.status === 'failed' ? 'failed' : 'completed')
      setWorkflowStatus(eventSummaryToWorkflowStatus(currentEvent))
      return () => controller.abort()
    }

    setStatus('connecting')

    let active = true
    let messageCount = 0
    const streamErrors = {
      activity: null as string | null,
      output: null as string | null,
    }
    const observedTerminal = createObservedStreamTerminalState()
    const effectiveEvent = (): AgentEventSummary =>
      applyObservedStreamTerminalStatus(currentEvent, observedTerminal)
    const shouldRetryStreams = (): boolean =>
      shouldRetryAfterStreamEnd(effectiveEvent())

    const applyActivityStatus = (statusData: WorkflowStatusData): void => {
      latestActivityRef.current = statusData
      if (!controller.signal.aborted) {
        setWorkflowStatus(statusData)
      }
    }

    const outputPromise = runStreamWithRetry({
      signal: controller.signal,
      shouldContinue: () => active && !controller.signal.aborted,
      onWorkflowUnavailable: () => onWorkflowUnavailableRef.current?.(),
      run: async () => {
        await consumeOutputStream({
          agentId,
          eventId: currentEvent.id,
          signal: controller.signal,
          onMessage: (message) => {
            if (!controller.signal.aborted) {
              messageCount += 1
              setStatus('streaming')
              setWorkflowStatus(latestActivityRef.current)
              setMessages((current) => upsertMessage(current, message))
            }
          },
        })
      },
      shouldRetryAfterEnd: shouldRetryStreams,
    }).then(
      () => undefined,
      (reason: unknown) => {
        if (active && !controller.signal.aborted) {
          streamErrors.output = readErrorMessage(reason)
        }
      }
    )

    const activityPromise = runStreamWithRetry({
      signal: controller.signal,
      shouldContinue: () => active && !controller.signal.aborted,
      onWorkflowUnavailable: () => onWorkflowUnavailableRef.current?.(),
      run: async () => {
        await consumeActivityStream({
          agentId,
          eventId: currentEvent.id,
          signal: controller.signal,
          onEvent: (runEvent) => {
            if (!controller.signal.aborted) {
              observeRunEventTerminalStatus(observedTerminal, runEvent)
              setStatus('streaming')
              applyActivityStatus(runEventToWorkflowStatus(runEvent))
            }
          },
        })
      },
      shouldRetryAfterEnd: shouldRetryStreams,
    }).then(
      () => undefined,
      (reason: unknown) => {
        if (active && !controller.signal.aborted) {
          streamErrors.activity = readErrorMessage(reason)
        }
      }
    )

    const settleStreams = async (): Promise<void> => {
      await Promise.all([outputPromise, activityPromise])
      if (!(active && !controller.signal.aborted)) {
        return
      }

      const eventForOutcome = effectiveEvent()
      const outcome = resolveTranscriptOutcome({
        activityError: streamErrors.activity,
        event: eventForOutcome,
        hasMessages: messageCount > 0,
        outputError: streamErrors.output,
      })

      if (outcome.kind === 'failed') {
        setError(outcome.message)
        setWarning(null)
        setStatus('failed')
        setWorkflowStatus(terminalErrorToWorkflowStatus(outcome.message))
        return
      }

      if (outcome.kind === 'partial') {
        setError(null)
        setWarning(outcome.warning)
        setStatus(statusForTerminalEvent(eventForOutcome))
        setWorkflowStatus(
          latestActivityRef.current ??
            eventSummaryToWorkflowStatus(eventForOutcome)
        )
        return
      }

      setError(null)
      setWarning(null)
      setStatus(statusForTerminalEvent(eventForOutcome))
      setWorkflowStatus(
        latestActivityRef.current ??
          eventSummaryToWorkflowStatus(eventForOutcome)
      )
    }

    settleStreams().catch((reason: unknown) => {
      if (!(active && !controller.signal.aborted)) {
        return
      }
      const message = readErrorMessage(reason)
      setError(message)
      setWarning(null)
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

  return { error, messages, status, warning, workflowStatus }
}

async function processStreamAttemptError(input: {
  attempt: number
  onWorkflowUnavailable?: () => void
  reason: unknown
  signal: AbortSignal
  shouldContinue: () => boolean
}): Promise<number | 'pending' | null> {
  if (input.signal.aborted || !input.shouldContinue()) {
    return null
  }
  if (input.reason instanceof StreamPendingError) {
    await sleep(STREAM_PENDING_RETRY_MS, input.signal)
    return 'pending'
  }
  if (input.reason instanceof StreamUnavailableError) {
    input.onWorkflowUnavailable?.()
    throw input.reason
  }
  const nextAttempt = input.attempt + 1
  if (nextAttempt >= STREAM_MAX_ATTEMPTS) {
    throw input.reason
  }
  return nextAttempt
}

async function runStreamWithRetry(input: {
  onWorkflowUnavailable?: () => void
  run: () => Promise<void>
  shouldContinue: () => boolean
  shouldRetryAfterEnd: () => boolean
  signal: AbortSignal
}): Promise<void> {
  let attempt = 0

  while (input.shouldContinue()) {
    try {
      await input.run()
      if (!(input.shouldRetryAfterEnd() && input.shouldContinue())) {
        return
      }
      attempt += 1
      if (attempt >= STREAM_MAX_ATTEMPTS) {
        throw new Error('Event stream ended before the run finished.')
      }
    } catch (reason) {
      const nextAttempt = await processStreamAttemptError({
        attempt,
        onWorkflowUnavailable: input.onWorkflowUnavailable,
        reason,
        signal: input.signal,
        shouldContinue: input.shouldContinue,
      })
      if (nextAttempt === null) {
        return
      }
      if (nextAttempt === 'pending') {
        continue
      }
      attempt = nextAttempt
    }

    await sleep(backoffMs(attempt - 1), input.signal)
  }
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
  if (isEventStreamPendingHttpStatus(response.status)) {
    throw new StreamPendingError()
  }
  if (isEventStreamUnavailableHttpStatus(response.status)) {
    const message = await readStreamErrorMessage(response)
    throw new StreamUnavailableError(
      message ?? WORKFLOW_STREAM_UNAVAILABLE_MESSAGE
    )
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
            decoder.decode(value, { stream: true }),
            NDJSON_OPTIONS
          )
          buffer = parsed.buffer
          for (const item of parsed.values) {
            controller.enqueue(item)
          }
        }
        const tail = decoder.decode()
        if (tail.length > 0) {
          const parsed = parseNdjsonChunk<T>(buffer, tail, NDJSON_OPTIONS)
          buffer = parsed.buffer
          for (const item of parsed.values) {
            controller.enqueue(item)
          }
        }
        for (const item of flushNdjsonBuffer<T>(buffer, NDJSON_OPTIONS)
          .values) {
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

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) {
    return Promise.resolve()
  }
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => {
      signal.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    const onAbort = (): void => {
      window.clearTimeout(timer)
      signal.removeEventListener('abort', onAbort)
      resolve()
    }
    signal.addEventListener('abort', onAbort, { once: true })
  })
}

class StreamPendingError extends Error {
  constructor() {
    super('Event stream is not ready yet.')
    this.name = 'StreamPendingError'
  }
}

class StreamUnavailableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'StreamUnavailableError'
  }
}

async function readStreamErrorMessage(
  response: Response
): Promise<string | null> {
  try {
    const body = (await response.json()) as { error?: string }
    return typeof body.error === 'string' ? body.error : null
  } catch {
    return null
  }
}
