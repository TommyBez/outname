import type {
  AgentChatMessage,
  WorkflowStatusData,
} from '@/agent-runtime/server/chat-status'
import type { RunEvent } from '@/agent-runtime/server/run-events'
import type { AgentEventSummary } from './event-types'

export const EVENT_ACTIVITY_METADATA_KEY = 'eventTranscriptActivity'

export interface EventActivityMetadata {
  timestamp: string
  tone: 'default' | 'error'
  transient: true
}

export interface AgentEventTranscriptPayload {
  messages: AgentChatMessage[]
  workflowStatus: WorkflowStatusData | null
}

export function runEventToAgentChatMessage(
  event: RunEvent,
  index: number
): AgentChatMessage {
  return activityMessage({
    id: `activity:${event.ts}:${event.type}:${index}`,
    message: formatRunEvent(event),
    timestamp: new Date(event.ts).toISOString(),
    tone: eventTone(event),
  })
}

export function runEventToWorkflowStatus(event: RunEvent): WorkflowStatusData {
  return {
    message: formatRunEvent(event),
    phase: 'agent-stream',
    timestamp: new Date(event.ts).toISOString(),
  }
}

export function eventSummaryToAgentChatMessage(
  event: AgentEventSummary
): AgentChatMessage {
  return activityMessage({
    id: `event:${event.id}:${event.status}`,
    message: formatEventSummary(event),
    timestamp: event.startedAt ?? event.queuedAt,
    tone: event.status === 'failed' ? 'error' : 'default',
  })
}

export function eventSummaryToWorkflowStatus(
  event: AgentEventSummary
): WorkflowStatusData {
  return {
    message: formatEventSummary(event),
    phase: 'agent-stream',
    timestamp: event.startedAt ?? event.queuedAt,
  }
}

function terminalErrorToAgentChatMessage(
  eventId: string,
  message: string,
  timestamp?: string
): AgentChatMessage {
  return activityMessage({
    id: `event:${eventId}:error`,
    message,
    timestamp: timestamp ?? new Date().toISOString(),
    tone: 'error',
  })
}

export function terminalErrorToWorkflowStatus(
  message: string
): WorkflowStatusData {
  return {
    message,
    phase: 'agent-stream',
    timestamp: new Date().toISOString(),
  }
}

export function fallbackEventTranscriptMessages(
  event: AgentEventSummary
): AgentChatMessage[] {
  if (event.status === 'failed' && event.lastError) {
    return [
      terminalErrorToAgentChatMessage(
        event.id,
        event.lastError,
        event.completedAt ?? event.startedAt ?? event.queuedAt
      ),
    ]
  }
  return [eventSummaryToAgentChatMessage(event)]
}

export function readEventActivityMetadata(
  message: { metadata?: unknown } | null | undefined
): EventActivityMetadata | null {
  const metadata = message?.metadata
  if (!(typeof metadata === 'object' && metadata !== null)) {
    return null
  }
  const value = (metadata as Record<string, unknown>)[
    EVENT_ACTIVITY_METADATA_KEY
  ]
  if (!(typeof value === 'object' && value !== null)) {
    return null
  }
  const activity = value as Partial<EventActivityMetadata>
  if (
    typeof activity.timestamp === 'string' &&
    (activity.tone === 'default' || activity.tone === 'error') &&
    activity.transient === true
  ) {
    return {
      timestamp: activity.timestamp,
      tone: activity.tone,
      transient: true,
    }
  }
  return null
}

function activityMessage(input: {
  id: string
  message: string
  timestamp: string
  tone: EventActivityMetadata['tone']
}): AgentChatMessage {
  return {
    id: input.id,
    metadata: {
      [EVENT_ACTIVITY_METADATA_KEY]: {
        timestamp: input.timestamp,
        tone: input.tone,
        transient: true,
      },
    },
    parts: [{ text: input.message, type: 'text' }],
    role: 'assistant',
  }
}

function formatRunEvent(event: RunEvent): string {
  switch (event.type) {
    case 'activity':
      return event.message
    case 'run':
      return `${capitalize(event.status)}: ${event.message}`
    case 'step':
      return `${capitalize(event.step)} ${event.status}: ${event.message}`
    default: {
      const exhaustive: never = event
      return exhaustive
    }
  }
}

function formatEventSummary(event: AgentEventSummary): string {
  if (event.status === 'queued') {
    if (event.blockedByEventId) {
      return 'Event queued behind another active event.'
    }
    return 'Event queued. Waiting for the worker to pick it up.'
  }
  if (event.status === 'starting') {
    return 'Event is starting.'
  }
  if (event.status === 'running') {
    return 'Event is running.'
  }
  if (event.status === 'failed') {
    return event.lastError ?? 'Event failed.'
  }
  if (event.status === 'cancelled') {
    return 'Event was cancelled.'
  }
  return 'Event completed.'
}

function eventTone(event: RunEvent): EventActivityMetadata['tone'] {
  if (event.type === 'run' && event.status === 'failed') {
    return 'error'
  }
  if (event.type === 'step' && event.status === 'error') {
    return 'error'
  }
  return 'default'
}

function capitalize(value: string): string {
  return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`
}
