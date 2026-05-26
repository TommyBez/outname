import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockGetAgentEvent, mockGetReadable, mockGetRun, mockGetSession } =
  vi.hoisted(() => ({
    mockGetAgentEvent: vi.fn(),
    mockGetReadable: vi.fn(),
    mockGetRun: vi.fn(),
    mockGetSession: vi.fn(),
  }))

vi.mock('workflow/api', () => ({
  getRun: mockGetRun,
}))

vi.mock('server-only', () => ({}))

vi.mock('@/agent-runtime/server/agent-event-store', () => ({
  getAgentEvent: mockGetAgentEvent,
}))

vi.mock('@/auth/server/auth-guard', () => ({
  getSession: mockGetSession,
}))

import { GET } from './route'

describe('events stream route', () => {
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
      payload: {
        streamToken: 'stream_123',
      },
      type: 'invocation',
      userId: 'user_123',
      workflowRunId: 'run_123',
    })
    mockGetRun.mockReturnValue({
      getReadable: mockGetReadable.mockReturnValue(
        new ReadableStream({
          start(controller) {
            controller.close()
          },
        })
      ),
      status: Promise.resolve('running'),
    })
  })

  it('passes through the requested start index', async () => {
    const request = new Request(
      'http://localhost:3000/api/agents/agent_123/events/evt_123/stream?stream=output&startIndex=7'
    )

    const response = await GET(request, {
      params: Promise.resolve({
        agentId: 'agent_123',
        eventId: 'evt_123',
      }),
    })

    expect(response.status).toBe(200)
    expect(mockGetReadable).toHaveBeenCalledWith({
      namespace: 'stream_123',
      startIndex: 7,
    })
  })
})
