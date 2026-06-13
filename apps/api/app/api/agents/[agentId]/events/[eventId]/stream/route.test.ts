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

vi.mock('@outname/ai/agent-runtime/server/agent-event-store', () => ({
  getAgentEvent: mockGetAgentEvent,
}))

vi.mock('@outname/ai/agent-runtime/server/agent-event-transcript', () => ({
  outputNamespaceForAgentEvent: vi.fn(() => 'stream_123'),
}))

vi.mock('@outname/auth/server/auth-guard', () => ({
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

  it('treats legacy starting sentinel workflow run ids as not started', async () => {
    mockGetAgentEvent.mockResolvedValue({
      agentId: 'agent_123',
      id: 'evt_123',
      payload: {},
      type: 'heartbeat',
      userId: 'user_123',
      workflowRunId: 'starting:evt_123',
    })

    const request = new Request(
      'http://localhost:3000/api/agents/agent_123/events/evt_123/stream'
    )

    const response = await GET(request, {
      params: Promise.resolve({
        agentId: 'agent_123',
        eventId: 'evt_123',
      }),
    })

    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({
      error: 'event has not started yet',
    })
    expect(mockGetRun).not.toHaveBeenCalled()
  })
})
