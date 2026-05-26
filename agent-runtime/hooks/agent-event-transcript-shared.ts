import type {
  AgentChatMessage,
  WorkflowStatusData,
} from '@/agent-runtime/server/chat-status'
import {
  eventSummaryToWorkflowStatus,
  fallbackEventTranscriptMessages,
} from '@/agent-runtime/shared/event-transcript'
import {
  type AgentEventSummary,
  isTerminalAgentEventStatus,
} from '@/agent-runtime/shared/event-types'

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

export function unavailableTranscriptState(): UseAgentEventTranscriptResult {
  return {
    error: null,
    messages: [],
    status: 'unavailable',
    warning: null,
    workflowStatus: null,
  }
}

export function createStoredTranscriptInitialState(
  event: AgentEventSummary
): UseAgentEventTranscriptResult {
  return {
    error: null,
    messages: [],
    status: statusForStoredEvent(event),
    warning: null,
    workflowStatus: eventSummaryToWorkflowStatus(event),
  }
}

export function createStoredTranscriptFailureState(
  event: AgentEventSummary,
  message: string
): UseAgentEventTranscriptResult {
  return {
    error: message,
    messages: shouldShowStoredFallbackMessages(event)
      ? fallbackEventTranscriptMessages(event)
      : [],
    status: statusForStoredEvent(event),
    warning: null,
    workflowStatus: eventSummaryToWorkflowStatus(event),
  }
}

export function createStoredTranscriptSuccessState(
  event: AgentEventSummary,
  input: {
    messages: AgentChatMessage[]
    workflowStatus: WorkflowStatusData | null
  }
): UseAgentEventTranscriptResult {
  return {
    error: null,
    messages: input.messages,
    status: statusForStoredEvent(event),
    warning: null,
    workflowStatus: input.workflowStatus ?? eventSummaryToWorkflowStatus(event),
  }
}

export function statusForEventWithoutRun(
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

export function statusForStoredEvent(
  event: AgentEventSummary
): AgentEventTranscriptStatus {
  if (isTerminalAgentEventStatus(event.status)) {
    return statusForTerminalEvent(event)
  }
  if (!currentEventHasWorkflowOutput(event)) {
    return statusForEventWithoutRun(event)
  }
  return statusForTerminalEvent(event)
}

export function statusForTerminalEvent(
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

export function shouldStreamLiveTranscript(event: AgentEventSummary): boolean {
  return event.status === 'running' && currentEventHasWorkflowOutput(event)
}

export function currentEventHasWorkflowOutput(
  event: AgentEventSummary
): boolean {
  return (
    typeof event.workflowRunId === 'string' && event.workflowRunId.length > 0
  )
}

function shouldShowStoredFallbackMessages(event: AgentEventSummary): boolean {
  return !currentEventHasWorkflowOutput(event)
}

export function readTranscriptErrorMessage(reason: unknown): string {
  if (reason instanceof Error) {
    return reason.message
  }
  return 'Event transcript is unavailable.'
}
