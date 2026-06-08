import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockEnqueueAgentEvent, mockFindActiveOrQueuedDreamingEventForAgent } =
  vi.hoisted(() => ({
    mockEnqueueAgentEvent: vi.fn(),
    mockFindActiveOrQueuedDreamingEventForAgent: vi.fn(),
  }))

vi.mock('server-only', () => ({}))

vi.mock('@outname/ai/agent-runtime/server/agent-events', () => ({
  enqueueAgentEvent: mockEnqueueAgentEvent,
}))

vi.mock('@outname/ai/agent-runtime/server/agent-event-store', () => ({
  findActiveOrQueuedDreamingEventForAgent:
    mockFindActiveOrQueuedDreamingEventForAgent,
}))

import { pokeDreaming } from './session-events'

const agent = {
  id: 'agent_123',
  userId: 'user_123',
}

describe('pokeDreaming', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns an existing active or queued dreaming event', async () => {
    mockFindActiveOrQueuedDreamingEventForAgent.mockResolvedValue({
      id: 'evt_existing',
      workflowRunId: 'wrun_existing',
    })

    await expect(
      pokeDreaming({ agent: agent as never, localDate: '2026-06-08' })
    ).resolves.toEqual({
      eventId: 'evt_existing',
      sessionRunId: 'wrun_existing',
    })
    expect(mockEnqueueAgentEvent).not.toHaveBeenCalled()
  })

  it('enqueues a new dreaming event with the per-agent concurrency key', async () => {
    mockFindActiveOrQueuedDreamingEventForAgent.mockResolvedValue(null)
    mockEnqueueAgentEvent.mockResolvedValue({
      eventId: 'evt_new',
      workflowRunId: 'wrun_new',
    })

    await pokeDreaming({ agent: agent as never, localDate: '2026-06-08' })

    expect(mockEnqueueAgentEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        concurrencyKey: 'dreaming:agent_123',
        payload: expect.objectContaining({ localDate: '2026-06-08' }),
        type: 'dreaming',
      })
    )
  })
})
