import type { AgentEvent } from '@outname/db/schema'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockGetReadable,
  mockGetRun,
  mockListAgentEventTranscriptMessages,
  mockReadUIMessageStream,
  mockSummarizeAgentEvent,
} = vi.hoisted(() => ({
  mockGetReadable: vi.fn(),
  mockGetRun: vi.fn(),
  mockListAgentEventTranscriptMessages: vi.fn(),
  mockReadUIMessageStream: vi.fn(),
  mockSummarizeAgentEvent: vi.fn(),
}))

vi.mock('ai', () => ({
  readUIMessageStream: mockReadUIMessageStream,
}))

vi.mock('server-only', () => ({}))

vi.mock('workflow/api', () => ({
  getRun: mockGetRun,
}))

vi.mock('./agent-event-summaries', () => ({
  summarizeAgentEvent: mockSummarizeAgentEvent,
}))

vi.mock('./agent-event-transcript-store', () => ({
  listAgentEventTranscriptMessages: mockListAgentEventTranscriptMessages,
}))

import {
  loadPersistedAgentEventTranscript,
  MissingPersistedEventTranscriptError,
  outputNamespaceForAgentEvent,
  readAgentEventTranscriptFromWorkflowRun,
} from './agent-event-transcript'

const invocationEvent = {
  id: 'evt_123',
  payload: {
    streamToken: 'stream_123',
  },
  type: 'invocation',
} satisfies Pick<AgentEvent, 'id' | 'payload' | 'type'>

const basePersistedEvent: AgentEvent = {
  agentId: 'agent_123',
  attempt: 1,
  claimExpiresAt: null,
  completedAt: null,
  concurrencyKey: null,
  createdAt: new Date('2026-05-23T09:58:00.000Z'),
  heartbeatAt: null,
  id: 'evt_123',
  idempotencyKey: 'event:evt_123',
  lastError: null,
  payload: {
    streamToken: 'stream_123',
  },
  publisherWorkflowRunId: null,
  queuedAt: new Date('2026-05-23T09:58:00.000Z'),
  scheduledFor: null,
  source: 'manual',
  startedAt: new Date('2026-05-23T09:59:00.000Z'),
  status: 'completed',
  type: 'invocation',
  updatedAt: new Date('2026-05-23T10:00:00.000Z'),
  userId: 'user_123',
  workflowRunId: 'run_123',
}

describe('agent event transcript service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('uses the invocation stream token as the output namespace', () => {
    expect(outputNamespaceForAgentEvent(invocationEvent)).toBe('stream_123')
  })

  it('throws for completed events missing persisted transcript rows', async () => {
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

    await expect(
      loadPersistedAgentEventTranscript(basePersistedEvent)
    ).rejects.toBeInstanceOf(MissingPersistedEventTranscriptError)
  })

  it('falls back only when the event has no workflow transcript to persist', async () => {
    mockListAgentEventTranscriptMessages.mockResolvedValue([])
    mockSummarizeAgentEvent.mockReturnValue({
      attempt: 1,
      blockedByEventId: null,
      completedAt: null,
      id: 'evt_queued',
      lastError: null,
      preview: null,
      queuedAt: '2026-05-23T09:58:00.000Z',
      source: 'manual',
      startedAt: null,
      status: 'queued',
      type: 'heartbeat',
      workflowRunId: null,
    })

    const queuedEvent: AgentEvent = {
      ...basePersistedEvent,
      completedAt: null,
      id: 'evt_queued',
      idempotencyKey: 'event:evt_queued',
      payload: {},
      startedAt: null,
      status: 'queued',
      type: 'heartbeat',
      updatedAt: new Date('2026-05-23T09:58:00.000Z'),
      workflowRunId: null,
    }

    const result = await loadPersistedAgentEventTranscript(queuedEvent)

    expect(result.messages).toMatchObject([
      {
        parts: [
          {
            text: 'Event queued. Waiting for the worker to pick it up.',
            type: 'text',
          },
        ],
        role: 'assistant',
      },
    ])
  })

  it('reconstructs final messages from the workflow output stream', async () => {
    mockGetRun.mockReturnValue({
      getReadable: mockGetReadable.mockReturnValue('readable-stream'),
    })
    mockReadUIMessageStream.mockReturnValue(
      (async function* () {
        await Promise.resolve()
        yield {
          id: 'msg_1',
          metadata: {},
          parts: [{ text: 'partial', type: 'text' }],
          role: 'assistant',
        }
        yield {
          id: 'msg_1',
          metadata: {},
          parts: [{ text: 'complete', type: 'text' }],
          role: 'assistant',
        }
      })()
    )

    const result = await readAgentEventTranscriptFromWorkflowRun({
      event: invocationEvent,
      workflowRunId: 'run_123',
    })

    expect(mockGetReadable).toHaveBeenCalledWith({
      namespace: 'stream_123',
      startIndex: 0,
    })
    expect(result).toEqual([
      {
        id: 'msg_1',
        metadata: {},
        parts: [{ text: 'complete', type: 'text' }],
        role: 'assistant',
      },
    ])
  })
})
