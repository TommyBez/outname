import type { AgentEvent } from '@outname/db/schema'
import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

vi.mock('@outname/db', () => ({
  db: {},
}))

vi.mock('./agent-event-reconciliation', () => ({
  reconcileActiveAgentEvent: vi.fn(),
}))

vi.mock('./agent-event-store', () => ({
  ACTIVE_EVENT_STATUSES: ['starting', 'running'],
  listRecentAgentEvents: vi.fn(),
}))

import { summarizeAgentEvent } from './agent-event-summaries'

describe('summarizeAgentEvent', () => {
  it('previews invocation input when payload shape is valid', () => {
    const summary = summarizeAgentEvent(
      agentEvent({
        payload: {
          callStack: [],
          depth: 0,
          input: 'summarize this',
          streamToken: 'reply:event_123',
        },
        type: 'invocation',
      })
    )

    expect(summary.preview).toBe('summarize this')
  })

  it('ignores malformed invocation payloads', () => {
    const summary = summarizeAgentEvent(
      agentEvent({
        payload: null as unknown as Record<string, unknown>,
        type: 'invocation',
      })
    )

    expect(summary.preview).toBeNull()
  })
})

function agentEvent(overrides: Partial<AgentEvent> = {}): AgentEvent {
  const now = new Date('2026-06-13T12:00:00.000Z')
  return {
    agentId: 'agent_123',
    attempt: 0,
    claimExpiresAt: null,
    completedAt: null,
    concurrencyKey: null,
    createdAt: now,
    heartbeatAt: null,
    id: 'event_123',
    idempotencyKey: 'idem_123',
    lastError: null,
    payload: {},
    queuedAt: now,
    scheduledFor: null,
    source: 'manual',
    startedAt: null,
    status: 'queued',
    type: 'heartbeat',
    updatedAt: now,
    userId: 'user_123',
    workflowRunId: null,
    ...overrides,
  }
}
