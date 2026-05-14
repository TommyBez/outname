export const AGENT_EVENT_STATUSES = [
  'queued',
  'starting',
  'running',
  'completed',
  'failed',
  'cancelled',
] as const

export type AgentEventStatus = (typeof AGENT_EVENT_STATUSES)[number]

export type AgentEventType = 'chat' | 'heartbeat' | 'dreaming' | 'invocation'

export type AgentEventSource =
  | 'chat'
  | 'slack'
  | 'scheduler'
  | 'manual'
  | 'invocation'

export interface AgentEventSummary {
  attempt: number
  blockedByEventId: string | null
  completedAt: string | null
  id: string
  lastError: string | null
  preview: string | null
  queuedAt: string
  source: AgentEventSource
  startedAt: string | null
  status: AgentEventStatus
  type: AgentEventType
  workflowRunId: string | null
}

export interface AgentEventsListResponse {
  events: AgentEventSummary[]
}

export function isTerminalAgentEventStatus(status: AgentEventStatus): boolean {
  return status === 'completed' || status === 'failed' || status === 'cancelled'
}

export function formatAgentEventSourceLabel(source: AgentEventSource): string {
  switch (source) {
    case 'chat':
      return 'chat'
    case 'slack':
      return 'slack'
    case 'scheduler':
      return 'scheduler'
    case 'manual':
      return 'manual'
    case 'invocation':
      return 'sub-agent'
    default: {
      const exhaustive: never = source
      return exhaustive
    }
  }
}

export function formatAgentEventTypeLabel(type: AgentEventType): string {
  switch (type) {
    case 'chat':
      return 'chat'
    case 'heartbeat':
      return 'heartbeat'
    case 'dreaming':
      return 'dreaming'
    case 'invocation':
      return 'sub-agent'
    default: {
      const exhaustive: never = type
      return exhaustive
    }
  }
}
