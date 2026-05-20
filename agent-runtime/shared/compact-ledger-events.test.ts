import { expect, test } from 'vitest'
import {
  compactLedgerEvents,
  TERMINAL_LEDGER_EVENTS_PER_TYPE,
} from './compact-ledger-events'
import type { AgentEventSummary } from './event-types'

function terminalEvent(input: {
  id: string
  queuedAt: string
  type: AgentEventSummary['type']
}): AgentEventSummary {
  return {
    attempt: 1,
    blockedByEventId: null,
    completedAt: input.queuedAt,
    id: input.id,
    lastError: null,
    preview: null,
    queuedAt: input.queuedAt,
    source: 'manual',
    startedAt: input.queuedAt,
    status: 'completed',
    type: input.type,
    workflowRunId: null,
  }
}

test('compactLedgerEvents keeps all live events and excludes chat', () => {
  const events: AgentEventSummary[] = [
    {
      ...terminalEvent({
        id: 'chat_1',
        queuedAt: '2026-05-14T09:00:00.000Z',
        type: 'chat',
      }),
      status: 'running',
    },
    {
      ...terminalEvent({
        id: 'hb_live',
        queuedAt: '2026-05-14T09:01:00.000Z',
        type: 'heartbeat',
      }),
      status: 'running',
    },
  ]

  const compacted = compactLedgerEvents(events)
  expect(compacted.map((event) => event.id)).toEqual(['hb_live'])
})

test('compactLedgerEvents keeps the three most recent terminal events per type', () => {
  const events = [
    terminalEvent({
      id: 'hb_1',
      queuedAt: '2026-05-14T09:04:00.000Z',
      type: 'heartbeat',
    }),
    terminalEvent({
      id: 'hb_2',
      queuedAt: '2026-05-14T09:03:00.000Z',
      type: 'heartbeat',
    }),
    terminalEvent({
      id: 'hb_3',
      queuedAt: '2026-05-14T09:02:00.000Z',
      type: 'heartbeat',
    }),
    terminalEvent({
      id: 'hb_4',
      queuedAt: '2026-05-14T09:01:00.000Z',
      type: 'heartbeat',
    }),
    terminalEvent({
      id: 'dream_1',
      queuedAt: '2026-05-14T08:00:00.000Z',
      type: 'dreaming',
    }),
  ]

  const compacted = compactLedgerEvents(events)
  expect(compacted.map((event) => event.id)).toEqual([
    'hb_1',
    'hb_2',
    'hb_3',
    'dream_1',
  ])
  expect(TERMINAL_LEDGER_EVENTS_PER_TYPE).toBe(3)
})
