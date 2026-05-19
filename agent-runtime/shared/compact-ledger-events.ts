import {
  type AgentEventStatus,
  type AgentEventSummary,
  isTerminalAgentEventStatus,
} from './event-types'

export const TERMINAL_LEDGER_EVENTS_PER_TYPE = 3

export function compactLedgerEvents(
  events: readonly AgentEventSummary[]
): AgentEventSummary[] {
  const live: AgentEventSummary[] = []
  const terminalByType = new Map<
    AgentEventSummary['type'],
    AgentEventSummary[]
  >()

  for (const event of events) {
    if (event.type === 'chat') {
      continue
    }
    if (!isTerminalAgentEventStatus(event.status)) {
      live.push(event)
      continue
    }
    const bucket = terminalByType.get(event.type) ?? []
    bucket.push(event)
    terminalByType.set(event.type, bucket)
  }

  const terminal: AgentEventSummary[] = []
  for (const typeEvents of terminalByType.values()) {
    terminal.push(...pickMostRecentTerminalEvents(typeEvents))
  }

  return sortAgentEvents([...live, ...terminal])
}

export function sortAgentEvents(
  events: readonly AgentEventSummary[]
): AgentEventSummary[] {
  return [...events].sort((first, second) => {
    const statusDelta = statusWeight(first.status) - statusWeight(second.status)
    if (statusDelta !== 0) {
      return statusDelta
    }
    return (
      new Date(second.queuedAt).getTime() - new Date(first.queuedAt).getTime()
    )
  })
}

function pickMostRecentTerminalEvents(
  events: readonly AgentEventSummary[]
): AgentEventSummary[] {
  return [...events]
    .sort(
      (first, second) =>
        new Date(second.queuedAt).getTime() - new Date(first.queuedAt).getTime()
    )
    .slice(0, TERMINAL_LEDGER_EVENTS_PER_TYPE)
}

function statusWeight(status: AgentEventStatus): number {
  switch (status) {
    case 'running':
      return 0
    case 'starting':
      return 1
    case 'queued':
      return 2
    case 'failed':
      return 3
    case 'completed':
      return 4
    case 'cancelled':
      return 5
    default: {
      const exhaustive: never = status
      return exhaustive
    }
  }
}
