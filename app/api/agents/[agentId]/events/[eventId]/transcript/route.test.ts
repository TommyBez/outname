import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockGetAgentEvent,
  mockGetReadable,
  mockGetRun,
  mockGetSession,
  mockListAgentEventTranscriptMessages,
  mockReadUIMessageStream,
  mockReplaceAgentEventTranscriptMessagesBestEffort,
  mockSummarizeAgentEvent,
} = vi.hoisted(() => ({
  mockGetAgentEvent: vi.fn(),
  mockGetReadable: vi.fn(),
  mockGetRun: vi.fn(),
  mockGetSession: vi.fn(),
  mockListAgentEventTranscriptMessages: vi.fn(),
  mockReadUIMessageStream: vi.fn(),
  mockReplaceAgentEventTranscriptMessagesBestEffort: vi.fn(),
  mockSummarizeAgentEvent: vi.fn(),
}))

vi.mock('ai', () => ({
  readUIMessageStream: mockReadUIMessageStream,
}))

vi.mock('workflow/api', () => ({
  getRun: mockGetRun,
}))

vi.mock('server-only', () => ({}))

vi.mock('@/agent-runtime/server/agent-event-store', () => ({
  getAgentEvent: mockGetAgentEvent,
}))

vi.mock('@/agent-runtime/server/agent-event-summaries', () => ({
  summarizeAgentEvent: mockSummarizeAgentEvent,
}))

vi.mock('@/agent-runtime/server/agent-event-transcript-store', () => ({
  listAgentEventTranscriptMessages: mockListAgentEventTranscriptMessages,
  replaceAgentEventTranscriptMessagesBestEffort:
    mockReplaceAgentEventTranscriptMessagesBestEffort,
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
      payload: {
        streamToken: 'stream_123',
      },
      status: 'completed',
      type: 'invocation',
      userId: 'user_123',
      workflowRunId: 'run_123',
    })
    mockSummarizeAgentEvent.mockReturnValue({
      attempt: 1,
      blockedByEventId: null,
      completedAt: '2026-05-23T10:00:00.000Z',
      id: 'evt_123',
      lastError: null,
      preview: null,
      queuedAt: '2026-05-23T09:58:00.000Z',
      source: 'manual',
      startedAt: '2026-05-23T09:59:00.000Z',
      status: 'completed',
      type: 'invocation',
      workflowRunId: 'run_123',
    })
    mockListAgentEventTranscriptMessages.mockResolvedValue([])
    mockGetRun.mockReturnValue({
      getReadable: mockGetReadable.mockReturnValue('readable-stream'),
      status: Promise.resolve('completed'),
    })
  })

  it('backfills transcript messages from workflow storage when db is empty', async () => {
    const workflowMessage = {
      id: 'msg_123',
      metadata: {},
      parts: [{ text: 'Recovered from workflow storage', type: 'text' }],
      role: 'assistant',
    }
    mockReadUIMessageStream.mockReturnValue(
      (async function* () {
        await Promise.resolve()
        yield workflowMessage
      })()
    )

    const response = await GET(new Request('http://localhost:3000'), {
      params: Promise.resolve({
        agentId: 'agent_123',
        eventId: 'evt_123',
      }),
    })

    expect(mockGetReadable).toHaveBeenCalledWith({
      namespace: 'stream_123',
      startIndex: 0,
    })
    expect(
      mockReplaceAgentEventTranscriptMessagesBestEffort
    ).toHaveBeenCalledWith({
      eventId: 'evt_123',
      messages: [workflowMessage],
      userId: 'user_123',
    })
    await expect(response.json()).resolves.toMatchObject({
      messages: [workflowMessage],
    })
  })
})
