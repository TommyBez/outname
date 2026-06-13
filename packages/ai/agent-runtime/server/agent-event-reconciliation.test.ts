import { beforeEach, expect, test, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import type { AgentEvent } from '@outname/db/schema'

vi.mock('./agent-event-store', () => ({
  getAgentEvent: vi.fn(),
  markEventRunning: vi.fn(),
  markEventTerminal: vi.fn(),
}))

vi.mock('./workflow-runs', () => ({
  isWorkflowRunAlive: vi.fn(),
  readWorkflowRunStatus: vi.fn(),
}))

import { reconcileActiveAgentEvent } from './agent-event-reconciliation'
import { getAgentEvent, markEventTerminal } from './agent-event-store'
import { isWorkflowRunAlive, readWorkflowRunStatus } from './workflow-runs'

const baseEvent: AgentEvent = {
  agentId: 'agent_1',
  attempt: 1,
  claimExpiresAt: null,
  completedAt: null,
  concurrencyKey: 'heartbeat:agent_1',
  createdAt: new Date('2026-05-14T09:00:00.000Z'),
  heartbeatAt: null,
  id: 'evt_1',
  idempotencyKey: 'key_1',
  lastError: null,
  payload: { scheduledAt: '2026-05-14T09:00:00.000Z' },
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

beforeEach(() => {
  vi.clearAllMocks()
})

test('missing workflow run marks event completed even when recent', async () => {
  vi.mocked(readWorkflowRunStatus).mockResolvedValue('not_found')
  vi.mocked(getAgentEvent).mockResolvedValue({
    ...baseEvent,
    completedAt: new Date('2026-05-14T09:05:00.000Z'),
    status: 'completed',
  })

  const result = await reconcileActiveAgentEvent(baseEvent)

  expect(markEventTerminal).toHaveBeenCalledWith({
    eventId: 'evt_1',
    status: 'completed',
  })
  expect(result.status).toBe('completed')
})

test('starting event with terminal workflow is marked completed', async () => {
  vi.mocked(isWorkflowRunAlive).mockResolvedValue(false)
  vi.mocked(readWorkflowRunStatus).mockResolvedValue('completed')
  vi.mocked(getAgentEvent).mockResolvedValue({
    ...baseEvent,
    completedAt: new Date('2026-05-14T09:05:00.000Z'),
    status: 'completed',
  })

  const result = await reconcileActiveAgentEvent({
    ...baseEvent,
    status: 'starting',
  })

  expect(markEventTerminal).toHaveBeenCalledWith({
    eventId: 'evt_1',
    status: 'completed',
  })
  expect(result.status).toBe('completed')
})

test('starting event with failed workflow is marked failed', async () => {
  vi.mocked(isWorkflowRunAlive).mockResolvedValue(false)
  vi.mocked(readWorkflowRunStatus).mockResolvedValue('failed')
  vi.mocked(getAgentEvent).mockResolvedValue({
    ...baseEvent,
    lastError: 'workflow failed',
    status: 'failed',
  })

  const result = await reconcileActiveAgentEvent({
    ...baseEvent,
    status: 'starting',
  })

  expect(markEventTerminal).toHaveBeenCalledWith({
    eventId: 'evt_1',
    lastError: 'workflow failed',
    status: 'failed',
  })
  expect(result.status).toBe('failed')
})

test('legacy starting sentinel is tolerated as a missing workflow run id', async () => {
  const result = await reconcileActiveAgentEvent({
    ...baseEvent,
    status: 'starting',
    workflowRunId: 'starting:evt_1',
  })

  expect(isWorkflowRunAlive).not.toHaveBeenCalled()
  expect(readWorkflowRunStatus).not.toHaveBeenCalled()
  expect(markEventTerminal).not.toHaveBeenCalled()
  expect(result.status).toBe('starting')
})
