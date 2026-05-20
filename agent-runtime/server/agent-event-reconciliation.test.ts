import { expect, test, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import type { AgentEvent } from '@/shared/db/schema'

vi.mock('./agent-event-store', () => ({
  getAgentEvent: vi.fn(),
  markEventRunning: vi.fn(),
  markEventTerminal: vi.fn(),
}))

vi.mock('./workflow-runs', () => ({
  isWorkflowRunAlive: vi.fn(),
  readWorkflowRunStatus: vi.fn(),
}))

vi.mock('./workflow-stream-retention', () => ({
  isPastWorkflowStreamRetention: vi.fn(),
}))

import { reconcileActiveAgentEvent } from './agent-event-reconciliation'
import { getAgentEvent, markEventTerminal } from './agent-event-store'
import { readWorkflowRunStatus } from './workflow-runs'
import { isPastWorkflowStreamRetention } from './workflow-stream-retention'

const baseEvent: AgentEvent = {
  agentId: 'agent_1',
  attempt: 1,
  claimExpiresAt: null,
  completedAt: null,
  concurrencyKey: 'heartbeat:agent_1',
  heartbeatAt: null,
  id: 'evt_1',
  idempotencyKey: 'key_1',
  lastError: null,
  payload: { scheduledAt: '2026-05-14T09:00:00.000Z' },
  publisherWorkflowRunId: null,
  queuedAt: new Date('2026-05-14T09:00:00.000Z'),
  scheduledFor: null,
  source: 'scheduler',
  startedAt: new Date('2026-05-14T09:01:00.000Z'),
  status: 'running',
  type: 'heartbeat',
  updatedAt: new Date('2026-05-14T09:01:00.000Z'),
  userId: 'user_1',
  workflowRunId: 'run_1',
}

test('missing workflow run within retention leaves event unchanged', async () => {
  vi.mocked(readWorkflowRunStatus).mockResolvedValue('not_found')
  vi.mocked(isPastWorkflowStreamRetention).mockReturnValue(false)

  const result = await reconcileActiveAgentEvent(baseEvent)

  expect(result).toBe(baseEvent)
  expect(markEventTerminal).not.toHaveBeenCalled()
})

test('missing workflow run after retention marks event completed', async () => {
  vi.mocked(readWorkflowRunStatus).mockResolvedValue('not_found')
  vi.mocked(isPastWorkflowStreamRetention).mockReturnValue(true)
  vi.mocked(getAgentEvent).mockResolvedValue({
    ...baseEvent,
    completedAt: new Date('2026-05-20T09:01:00.000Z'),
    status: 'completed',
  })

  const result = await reconcileActiveAgentEvent(baseEvent)

  expect(markEventTerminal).toHaveBeenCalledWith({
    eventId: 'evt_1',
    status: 'completed',
  })
  expect(result.status).toBe('completed')
})
