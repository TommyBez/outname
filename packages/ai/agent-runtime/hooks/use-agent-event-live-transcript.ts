'use client'

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
} from '@outname/ai/agent-runtime/hooks/agent-event-stream-outcome'
import type {
  AgentChatChunk,
  AgentChatMessage,
  WorkflowStatusData,
} from '@outname/ai/agent-runtime/server/chat-status'
import type { RunEvent } from '@outname/ai/agent-runtime/server/run-events'
import {
  eventSummaryToWorkflowStatus,
  runEventToWorkflowStatus,
  terminalErrorToWorkflowStatus,
} from '@outname/ai/agent-runtime/shared/event-transcript'
import type { AgentEventSummary } from '@outname/ai/agent-runtime/shared/event-types'
import {
  flushNdjsonBuffer,
  parseNdjsonChunk,
} from '@outname/ai/agent-runtime/shared/ndjson'
import { WORKFLOW_STREAM_UNAVAILABLE_MESSAGE } from '@outname/ai/agent-runtime/shared/workflow-stream-messages'
import { apiUrl } from '@outname/shared/api-url'
import { readUIMessageStream } from 'ai'
import { useEffect, useRef, useState } from 'react'
import {
  readTranscriptErrorMessage,
  statusForTerminalEvent,
  type UseAgentEventTranscriptResult,
  unavailableTranscriptState,
} from './agent-event-transcript-shared'

const NDJSON_OPTIONS = { skipInvalidLines: true } as const

export function useAgentEventLiveTranscript(input: {
  agentId: string
  enabled: boolean
  event: AgentEventSummary | null
  onWorkflowUnavailable?: () => void
}): UseAgentEventTranscriptResult {
  const { agentId, enabled, event, onWorkflowUnavailable } = input
  const [state, setState] = useState<UseAgentEventTranscriptResult>(() =>
    unavailableTranscriptState()
  )
  const onWorkflowUnavailableRef = useRef(onWorkflowUnavailable)
  onWorkflowUnavailableRef.current = onWorkflowUnavailable

  useEffect(() => {
    if (!(enabled && event)) {
      setState(unavailableTranscriptState())
      return
    }

    const controller = new AbortController()
    let active = true
    let activityStreamIndex = 0
    let messageCount = 0
    let outputStreamIndex = 0
    const streamErrors = {
      activity: null as string | null,
      output: null as string | null,
    }
    const observedTerminal = createObservedStreamTerminalState()
    const latestActivityRef = {
      current: eventSummaryToWorkflowStatus(event) as WorkflowStatusData | null,
    }

    setState({
      error: null,
      messages: [],
      status: 'connecting',
      warning: null,
      workflowStatus: latestActivityRef.current,
    })

    const effectiveEvent = (): AgentEventSummary =>
      applyObservedStreamTerminalStatus(event, observedTerminal)
    const shouldRetryStreams = (): boolean =>
      shouldRetryAfterStreamEnd(effectiveEvent())

    const applyActivityStatus = (statusData: WorkflowStatusData): void => {
      latestActivityRef.current = statusData
      if (!controller.signal.aborted) {
        setState((current) => ({
          ...current,
          workflowStatus: statusData,
        }))
      }
    }

    const outputPromise = runStreamWithRetry({
      signal: controller.signal,
      shouldContinue: () => active && !controller.signal.aborted,
      onWorkflowUnavailable: () => onWorkflowUnavailableRef.current?.(),
      run: async () => {
        await consumeOutputStream({
          agentId,
          eventId: event.id,
          onChunk: () => {
            outputStreamIndex += 1
          },
          signal: controller.signal,
          startIndex: outputStreamIndex,
          onMessage: (message) => {
            if (!controller.signal.aborted) {
              messageCount += 1
              setState((current) => ({
                ...current,
                messages: upsertMessage(current.messages, message),
                status: 'streaming',
                workflowStatus: latestActivityRef.current,
              }))
            }
          },
        })
      },
      shouldRetryAfterEnd: shouldRetryStreams,
    }).then(
      () => undefined,
      (reason: unknown) => {
        if (active && !controller.signal.aborted) {
          streamErrors.output = readTranscriptErrorMessage(reason)
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
          eventId: event.id,
          onChunk: () => {
            activityStreamIndex += 1
          },
          signal: controller.signal,
          startIndex: activityStreamIndex,
          onEvent: (runEvent) => {
            if (!controller.signal.aborted) {
              observeRunEventTerminalStatus(observedTerminal, runEvent)
              setState((current) => ({
                ...current,
                status: 'streaming',
              }))
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
          streamErrors.activity = readTranscriptErrorMessage(reason)
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
        setState((current) => ({
          ...current,
          error: outcome.message,
          status: 'failed',
          warning: null,
          workflowStatus: terminalErrorToWorkflowStatus(outcome.message),
        }))
        return
      }

      if (outcome.kind === 'partial') {
        setState((current) => ({
          ...current,
          error: null,
          status: statusForTerminalEvent(eventForOutcome),
          warning: outcome.warning,
          workflowStatus:
            latestActivityRef.current ??
            eventSummaryToWorkflowStatus(eventForOutcome),
        }))
        return
      }

      setState((current) => ({
        ...current,
        error: null,
        status: statusForTerminalEvent(eventForOutcome),
        warning: null,
        workflowStatus:
          latestActivityRef.current ??
          eventSummaryToWorkflowStatus(eventForOutcome),
      }))
    }

    settleStreams().catch((reason: unknown) => {
      if (!(active && !controller.signal.aborted)) {
        return
      }
      const message = readTranscriptErrorMessage(reason)
      setState((current) => ({
        ...current,
        error: message,
        status: 'failed',
        warning: null,
        workflowStatus: terminalErrorToWorkflowStatus(message),
      }))
    })

    return () => {
      active = false
      controller.abort()
    }
  }, [agentId, enabled, event])

  return state
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
  onChunk: () => void
  eventId: string
  onMessage: (message: AgentChatMessage) => void
  signal: AbortSignal
  startIndex: number
}): Promise<void> {
  const stream = await openEventStream<AgentChatChunk>({
    agentId: input.agentId,
    eventId: input.eventId,
    onChunk: input.onChunk,
    signal: input.signal,
    startIndex: input.startIndex,
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
  onChunk: () => void
  onEvent: (event: RunEvent) => void
  signal: AbortSignal
  startIndex: number
}): Promise<void> {
  const stream = await openEventStream<RunEvent>({
    agentId: input.agentId,
    eventId: input.eventId,
    onChunk: input.onChunk,
    signal: input.signal,
    startIndex: input.startIndex,
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
  onChunk: () => void
  signal: AbortSignal
  startIndex: number
  stream: 'activity' | 'output'
}): Promise<ReadableStream<T>> {
  const response = await fetch(
    apiUrl(
      `/api/agents/${input.agentId}/events/${input.eventId}/stream?stream=${input.stream}&startIndex=${input.startIndex}`
    ),
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
  return ndjsonReadable<T>(response.body, input.onChunk)
}

function ndjsonReadable<T>(
  body: ReadableStream<Uint8Array>,
  onChunk: () => void
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
            onChunk()
            controller.enqueue(item)
          }
        }
        const tail = decoder.decode()
        if (tail.length > 0) {
          const parsed = parseNdjsonChunk<T>(buffer, tail, NDJSON_OPTIONS)
          buffer = parsed.buffer
          for (const item of parsed.values) {
            onChunk()
            controller.enqueue(item)
          }
        }
        for (const item of flushNdjsonBuffer<T>(buffer, NDJSON_OPTIONS)
          .values) {
          onChunk()
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
