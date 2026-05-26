import { expect, test } from 'vitest'
import type { AgentEventSummary } from '@/agent-runtime/shared/event-types'
import { statusForStoredEvent } from './agent-event-transcript-shared'

const baseEvent: AgentEventSummary = {
  attempt: 1,
  blockedByEventId: null,
  completedAt: '2026-05-26T10:00:00.000Z',
  id: 'evt_123',
  lastError: null,
  preview: null,
  queuedAt: '2026-05-26T09:58:00.000Z',
  source: 'manual',
  startedAt: '2026-05-26T09:59:00.000Z',
  status: 'completed',
  type: 'heartbeat',
  workflowRunId: null,
}

test('statusForStoredEvent keeps completed events readable without workflow output', () => {
  expect(statusForStoredEvent(baseEvent)).toBe('completed')
})

test('statusForStoredEvent keeps cancelled events terminal without workflow output', () => {
  expect(
    statusForStoredEvent({
      ...baseEvent,
      status: 'cancelled',
    })
  ).toBe('completed')
})

test('statusForStoredEvent still uses the no-run fallback for queued events', () => {
  expect(
    statusForStoredEvent({
      ...baseEvent,
      completedAt: null,
      startedAt: null,
      status: 'queued',
    })
  ).toBe('queued')
})
