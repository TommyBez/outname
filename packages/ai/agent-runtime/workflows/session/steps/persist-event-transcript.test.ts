import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockReadAgentEventTranscriptFromWorkflowRun,
  mockReplaceAgentEventTranscriptMessagesBestEffort,
} = vi.hoisted(() => ({
  mockReadAgentEventTranscriptFromWorkflowRun: vi.fn(),
  mockReplaceAgentEventTranscriptMessagesBestEffort: vi.fn(),
}))

vi.mock('@outname/ai/agent-runtime/server/agent-event-transcript', () => ({
  readAgentEventTranscriptFromWorkflowRun:
    mockReadAgentEventTranscriptFromWorkflowRun,
}))

vi.mock(
  '@outname/ai/agent-runtime/server/agent-event-transcript-store',
  () => ({
    replaceAgentEventTranscriptMessagesBestEffort:
      mockReplaceAgentEventTranscriptMessagesBestEffort,
  })
)

import { persistAgentEventTranscriptStep } from './persist-event-transcript'

describe('persistAgentEventTranscriptStep', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('persists workflow transcript messages when the read succeeds', async () => {
    const messages = [
      {
        id: 'msg_1',
        parts: [{ text: 'Hello', type: 'text' as const }],
        role: 'assistant' as const,
      },
    ]

    mockReadAgentEventTranscriptFromWorkflowRun.mockResolvedValue(messages)

    await persistAgentEventTranscriptStep({
      event: { id: 'evt_123', payload: {}, type: 'heartbeat' },
      userId: 'user_123',
      workflowRunId: 'run_123',
    })

    expect(
      mockReplaceAgentEventTranscriptMessagesBestEffort
    ).toHaveBeenCalledWith({
      eventId: 'evt_123',
      messages,
      userId: 'user_123',
    })
  })

  it('falls back to the step limit notice when transcript reading fails', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)

    mockReadAgentEventTranscriptFromWorkflowRun.mockRejectedValue(
      new Error('stream failed')
    )

    await expect(
      persistAgentEventTranscriptStep({
        event: { id: 'evt_123', payload: {}, type: 'heartbeat' },
        stepLimitNotice: 'Reached the step limit.',
        userId: 'user_123',
        workflowRunId: 'run_123',
      })
    ).resolves.toBeUndefined()

    expect(consoleError).toHaveBeenCalledWith(
      '[agent-events] failed to read event transcript',
      {
        errorCode: 'AGENT_EVENT_TRANSCRIPT_READ_FAILED',
        errorMessage: 'stream failed',
        eventId: 'evt_123',
        workflowRunId: 'run_123',
      }
    )
    expect(
      mockReplaceAgentEventTranscriptMessagesBestEffort
    ).toHaveBeenCalledWith({
      eventId: 'evt_123',
      messages: [
        expect.objectContaining({
          parts: [{ text: 'Reached the step limit.', type: 'text' }],
          role: 'assistant',
        }),
      ],
      userId: 'user_123',
    })
  })
})
