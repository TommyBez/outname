'use client'

import { useMemo } from 'react'
import type { AgentEventSummary } from '@/agent-runtime/shared/event-types'
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
  const currentEvent = useMemo(() => {
    if (
      !(
        event?.id &&
        event.queuedAt &&
        event.source &&
        event.status &&
        event.type &&
        event.attempt !== null
      )
    ) {
      return null
    }
    return {
      attempt: event.attempt,
      blockedByEventId: event.blockedByEventId,
      completedAt: event.completedAt,
      id: event.id,
      lastError: event.lastError,
      preview: event.preview,
      queuedAt: event.queuedAt,
      source: event.source,
      startedAt: event.startedAt,
      status: event.status,
      type: event.type,
      workflowRunId: event.workflowRunId,
    } satisfies AgentEventSummary
  }, [
    event?.attempt,
    event?.blockedByEventId,
    event?.completedAt,
    event?.id,
    event?.lastError,
    event?.preview,
    event?.queuedAt,
    event?.source,
    event?.startedAt,
    event?.status,
    event?.type,
    event?.workflowRunId,
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
