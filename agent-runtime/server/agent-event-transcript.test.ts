import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockListAgentEventTranscriptMessages, mockSummarizeAgentEvent } =
  vi.hoisted(() => ({
    mockListAgentEventTranscriptMessages: vi.fn(),
    mockSummarizeAgentEvent: vi.fn(),
  }))

vi.mock('server-only', () => ({}))

vi.mock('./agent-event-summaries', () => ({
  summarizeAgentEvent: mockSummarizeAgentEvent,
}))

vi.mock('./agent-event-transcript-store', () => ({
  listAgentEventTranscriptMessages: mockListAgentEventTranscriptMessages,
}))

import {
  loadPersistedAgentEventTranscript,
  outputNamespaceForAgentEvent,
} from './agent-event-transcript'

describe('agent event transcript service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('uses the invocation stream token as the output namespace', () => {
    expect(
      outputNamespaceForAgentEvent({
        id: 'evt_123',
        payload: {
          streamToken: 'stream_123',
        },
        type: 'invocation',
      } as never)
    ).toBe('stream_123')
  })

  it('falls back to summary messages when no persisted transcript exists', async () => {
    mockListAgentEventTranscriptMessages.mockResolvedValue([])
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

    const result = await loadPersistedAgentEventTranscript({
      id: 'evt_123',
      payload: {
        streamToken: 'stream_123',
      },
      queuedAt: new Date('2026-05-23T09:58:00.000Z'),
      source: 'manual',
      startedAt: new Date('2026-05-23T09:59:00.000Z'),
      status: 'completed',
      type: 'invocation',
      workflowRunId: 'run_123',
    } as never)

    expect(result.messages).toMatchObject([
      {
        parts: [{ text: 'Event completed.', type: 'text' }],
        role: 'assistant',
      },
    ])
    expect(result.workflowStatus).toEqual({
      message: 'Event completed.',
      phase: 'agent-stream',
      timestamp: '2026-05-23T09:59:00.000Z',
    })
  })
})
