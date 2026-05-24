import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockGetAgentEvent,
  mockGetSession,
  mockLoadPersistedAgentEventTranscript,
} = vi.hoisted(() => ({
  mockGetAgentEvent: vi.fn(),
  mockGetSession: vi.fn(),
  mockLoadPersistedAgentEventTranscript: vi.fn(),
}))

vi.mock('server-only', () => ({}))

vi.mock('@/agent-runtime/server/agent-event-store', () => ({
  getAgentEvent: mockGetAgentEvent,
}))

vi.mock('@/agent-runtime/server/agent-event-transcript', () => ({
  loadPersistedAgentEventTranscript: mockLoadPersistedAgentEventTranscript,
}))

vi.mock('@/auth/server/auth-guard', () => ({
  getSession: mockGetSession,
}))

import { GET } from './route'

describe('events transcript route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSession.mockResolvedValue({
      user: {
        id: 'user_123',
      },
    })
    mockGetAgentEvent.mockResolvedValue({
      agentId: 'agent_123',
      id: 'evt_123',
      status: 'completed',
      type: 'invocation',
      userId: 'user_123',
      workflowRunId: 'run_123',
    })
    mockLoadPersistedAgentEventTranscript.mockResolvedValue({
      messages: [
        {
          id: 'msg_123',
          metadata: {},
          parts: [{ text: 'Persisted transcript', type: 'text' }],
          role: 'assistant',
        },
      ],
      workflowStatus: {
        message: 'Event completed.',
        phase: 'agent-stream',
        timestamp: '2026-05-23T10:00:00.000Z',
      },
    })
  })

  it('returns the persisted transcript payload from the service', async () => {
    const response = await GET(new Request('http://localhost:3000'), {
      params: Promise.resolve({
        agentId: 'agent_123',
        eventId: 'evt_123',
      }),
    })

    expect(mockLoadPersistedAgentEventTranscript).toHaveBeenCalledWith({
      agentId: 'agent_123',
      id: 'evt_123',
      status: 'completed',
      type: 'invocation',
      userId: 'user_123',
      workflowRunId: 'run_123',
    })
    await expect(response.json()).resolves.toMatchObject({
      messages: [
        {
          id: 'msg_123',
          parts: [{ text: 'Persisted transcript', type: 'text' }],
          role: 'assistant',
        },
      ],
    })
  })
})
