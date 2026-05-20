import type { RunEvent } from '@/agent-runtime/server/run-events'
import type { AgentEventSummary } from '@/agent-runtime/shared/event-types'
import { isTerminalAgentEventStatus } from '@/agent-runtime/shared/event-types'
import { isWorkflowStreamUnavailableMessage } from '@/agent-runtime/shared/workflow-stream-messages'

export const STREAM_MAX_ATTEMPTS = 5
export const STREAM_PENDING_RETRY_MS = 1500
export const STREAM_BACKOFF_MS = [1000, 2000, 4000, 8000] as const

export interface ObservedStreamTerminalState {
  lastError: string | null
  status: AgentEventSummary['status'] | null
}

export function createObservedStreamTerminalState(): ObservedStreamTerminalState {
  return { lastError: null, status: null }
}

export function observeRunEventTerminalStatus(
  observed: ObservedStreamTerminalState,
  runEvent: RunEvent
): void {
  if (runEvent.type !== 'run') {
    return
  }
  if (runEvent.status === 'completed') {
    observed.status = 'completed'
    observed.lastError = null
    return
  }
  if (runEvent.status === 'failed') {
    observed.status = 'failed'
    observed.lastError = runEvent.message
  }
}

export function applyObservedStreamTerminalStatus(
  event: AgentEventSummary,
  observed: ObservedStreamTerminalState
): AgentEventSummary {
  if (!observed.status) {
    return event
  }
  return {
    ...event,
    lastError: observed.lastError ?? event.lastError,
    status: observed.status,
  }
}

export interface ResolveTranscriptOutcomeInput {
  activityError: string | null
  event: AgentEventSummary
  hasMessages: boolean
  outputError: string | null
}

export type TranscriptOutcome =
  | { kind: 'failed'; message: string }
  | { kind: 'partial'; message: string | null; warning: string }
  | { kind: 'ready' }

export function backoffMs(attempt: number): number {
  const index = Math.min(attempt, STREAM_BACKOFF_MS.length - 1)
  return STREAM_BACKOFF_MS[index] ?? STREAM_BACKOFF_MS.at(-1) ?? 8000
}

export function shouldRetryAfterStreamEnd(event: AgentEventSummary): boolean {
  return !isTerminalAgentEventStatus(event.status)
}

/** Transient: event or workflow not ready to stream yet. */
export function isEventStreamPendingHttpStatus(status: number): boolean {
  return status === 409
}

/** Permanent in this environment: workflow run cannot be read. */
export function isEventStreamUnavailableHttpStatus(status: number): boolean {
  return status === 503
}

export function resolveTranscriptOutcome(
  input: ResolveTranscriptOutcomeInput
): TranscriptOutcome {
  const { activityError, event, hasMessages, outputError } = input

  if (outputError && !hasMessages) {
    if (isTerminalAgentEventStatus(event.status)) {
      return { kind: 'ready' }
    }
    if (isWorkflowStreamUnavailableMessage(outputError)) {
      return {
        kind: 'partial',
        message: null,
        warning: outputError,
      }
    }
    return { kind: 'failed', message: outputError }
  }

  if (outputError && hasMessages && isTerminalAgentEventStatus(event.status)) {
    return { kind: 'ready' }
  }

  if (outputError && hasMessages) {
    return {
      kind: 'partial',
      message: null,
      warning: outputError,
    }
  }

  if (activityError && !outputError) {
    return {
      kind: 'partial',
      message: null,
      warning: activityError,
    }
  }

  return { kind: 'ready' }
}
