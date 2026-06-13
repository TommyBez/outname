'use client'

import type { AgentEventSummary } from '@outname/ai/agent-runtime/shared/event-types'
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
  const currentEvent = event

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
