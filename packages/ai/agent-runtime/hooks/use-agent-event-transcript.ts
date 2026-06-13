'use client'

import type { AgentEventSummary } from '@outname/ai/agent-runtime/shared/event-types'
import { useMemo } from 'react'
import {
  shouldStreamLiveTranscript,
  type UseAgentEventTranscriptResult,
  unavailableTranscriptState,
} from './agent-event-transcript-shared'
import { useAgentEventLiveTranscript } from './use-agent-event-live-transcript'
import { useAgentEventStoredTranscript } from './use-agent-event-stored-transcript'

export function useAgentEventTranscript(input: {
  agentId: string
  event: AgentEventSummary | null
  onWorkflowUnavailable?: () => void
}): UseAgentEventTranscriptResult {
  const { agentId, event, onWorkflowUnavailable } = input
  const eventAttempt = event?.attempt
  const eventBlockedByEventId = event?.blockedByEventId
  const eventCompletedAt = event?.completedAt
  const eventId = event?.id
  const eventLastError = event?.lastError
  const eventPreview = event?.preview
  const eventQueuedAt = event?.queuedAt
  const eventSource = event?.source
  const eventStartedAt = event?.startedAt
  const eventStatus = event?.status
  const eventType = event?.type
  const eventWorkflowRunId = event?.workflowRunId
  const currentEvent = useMemo<AgentEventSummary | null>(() => {
    if (
      eventAttempt === undefined ||
      eventId === undefined ||
      eventQueuedAt === undefined ||
      eventSource === undefined ||
      eventStatus === undefined ||
      eventType === undefined
    ) {
      return null
    }
    return {
      attempt: eventAttempt,
      blockedByEventId: eventBlockedByEventId ?? null,
      completedAt: eventCompletedAt ?? null,
      id: eventId,
      lastError: eventLastError ?? null,
      preview: eventPreview ?? null,
      queuedAt: eventQueuedAt,
      source: eventSource,
      startedAt: eventStartedAt ?? null,
      status: eventStatus,
      type: eventType,
      workflowRunId: eventWorkflowRunId ?? null,
    }
  }, [
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

  const shouldUseLiveStream = currentEvent
    ? shouldStreamLiveTranscript(currentEvent)
    : false
  const liveTranscript = useAgentEventLiveTranscript({
    agentId,
    enabled: shouldUseLiveStream,
    event: currentEvent,
    onWorkflowUnavailable,
  })
  const storedTranscript = useAgentEventStoredTranscript({
    agentId,
    enabled: !shouldUseLiveStream,
    event: currentEvent,
  })

  if (!currentEvent) {
    return unavailableTranscriptState()
  }

  return shouldUseLiveStream ? liveTranscript : storedTranscript
}
