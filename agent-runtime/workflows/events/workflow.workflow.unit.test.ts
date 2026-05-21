import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockGetWorkflowMetadata,
  mockHandleHeartbeat,
  mockHandleInvocation,
  mockCleanupEventResources,
  mockLoadAgentEventStep,
  mockMarkAgentEventHeartbeatStep,
  mockMarkAgentEventRunningStep,
  mockMarkAgentEventTerminalStep,
  mockStartNextQueuedEvent,
} = vi.hoisted(() => ({
  mockGetWorkflowMetadata: vi.fn(),
  mockHandleHeartbeat: vi.fn(),
  mockHandleInvocation: vi.fn(),
  mockCleanupEventResources: vi.fn(),
  mockLoadAgentEventStep: vi.fn(),
  mockMarkAgentEventHeartbeatStep: vi.fn(),
  mockMarkAgentEventRunningStep: vi.fn(),
  mockMarkAgentEventTerminalStep: vi.fn(),
  mockStartNextQueuedEvent: vi.fn(),
}))

vi.mock('workflow', () => ({
  getWorkflowMetadata: mockGetWorkflowMetadata,
}))

vi.mock('server-only', () => ({}))

vi.mock('../session/handlers/handle-heartbeat', () => ({
  handleHeartbeat: mockHandleHeartbeat,
}))

vi.mock('../session/handlers/handle-invocation', () => ({
  handleInvocation: mockHandleInvocation,
}))

vi.mock('./steps/cleanup-event', () => ({
  cleanupEventResources: mockCleanupEventResources,
}))

vi.mock('./steps/event-store', () => ({
  loadAgentEventStep: mockLoadAgentEventStep,
  markAgentEventHeartbeatStep: mockMarkAgentEventHeartbeatStep,
  markAgentEventRunningStep: mockMarkAgentEventRunningStep,
  markAgentEventTerminalStep: mockMarkAgentEventTerminalStep,
}))

vi.mock('./steps/start-next-event', () => ({
  startNextQueuedEvent: mockStartNextQueuedEvent,
}))

import { agentEventWorkflow } from './workflow'

function createEvent(overrides: Record<string, unknown> = {}) {
  return {
    agentId: 'agent_123',
    concurrencyKey: 'key_123',
    id: 'evt_123',
    payload: {},
    publisherWorkflowRunId: null,
    source: 'manual',
    status: 'starting',
    type: 'heartbeat',
    workflowRunId: null,
    ...overrides,
  }
}

describe('agentEventWorkflow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetWorkflowMetadata.mockReturnValue({
      workflowRunId: 'wrun_default',
    })
  })

  it('returns early when the event record is gone', async () => {
    mockLoadAgentEventStep.mockResolvedValue(null)

    await agentEventWorkflow({ eventId: 'evt_missing' })

    expect(mockMarkAgentEventRunningStep).not.toHaveBeenCalled()
    expect(mockCleanupEventResources).not.toHaveBeenCalled()
    expect(mockStartNextQueuedEvent).not.toHaveBeenCalled()
  })

  it('dispatches heartbeat events', async () => {
    const event = createEvent({
      payload: {
        manual: true,
        scheduledAt: '2026-05-14T20:30:00.000Z',
      },
      status: 'running',
      type: 'heartbeat',
      workflowRunId: 'wrun_saved',
    })

    mockGetWorkflowMetadata.mockReturnValue({
      workflowRunId: 'wrun_runtime',
    })
    mockLoadAgentEventStep.mockResolvedValue(event)

    await agentEventWorkflow({ eventId: event.id })

    expect(mockMarkAgentEventRunningStep).toHaveBeenCalledWith({
      eventId: event.id,
      workflowRunId: 'wrun_runtime',
    })
    expect(mockMarkAgentEventHeartbeatStep).toHaveBeenCalledWith({
      eventId: event.id,
    })
    expect(mockHandleHeartbeat).toHaveBeenCalledWith({
      agentId: 'agent_123',
      manual: true,
      mode: 'normal',
      replyToken: 'reply:evt_123',
      scheduledAt: '2026-05-14T20:30:00.000Z',
    })
    expect(mockMarkAgentEventTerminalStep).toHaveBeenCalledWith({
      eventId: event.id,
      status: 'completed',
    })
    expect(mockCleanupEventResources).toHaveBeenCalledWith({
      agentId: 'agent_123',
    })
    expect(mockStartNextQueuedEvent).toHaveBeenCalledWith({
      concurrencyKey: 'key_123',
    })
  })

  it('dispatches dreaming events in dreaming mode', async () => {
    const event = createEvent({
      payload: {
        localDate: '2026-05-14',
        manual: false,
        scheduledAt: '2026-05-14T20:30:00.000Z',
      },
      type: 'dreaming',
    })

    mockLoadAgentEventStep.mockResolvedValue(event)

    await agentEventWorkflow({ eventId: event.id })

    expect(mockHandleHeartbeat).toHaveBeenCalledWith({
      agentId: 'agent_123',
      localDate: '2026-05-14',
      manual: false,
      mode: 'dreaming',
      replyToken: 'reply:evt_123',
      scheduledAt: '2026-05-14T20:30:00.000Z',
    })
  })

  it('dispatches invocation events and normalizes missing parent references', async () => {
    const event = createEvent({
      payload: {
        callStack: ['tool_a'],
        depth: 2,
        input: 'hello',
        streamToken: 'stream_123',
      },
      type: 'invocation',
    })

    mockLoadAgentEventStep.mockResolvedValue(event)

    await agentEventWorkflow({ eventId: event.id })

    expect(mockHandleInvocation).toHaveBeenCalledWith({
      agentId: 'agent_123',
      callStack: ['tool_a'],
      depth: 2,
      input: 'hello',
      parentRunId: null,
      parentStream: null,
      parentToolCallId: null,
      parentToolId: null,
      replyToken: 'reply:evt_123',
      streamToken: 'stream_123',
    })
  })

  it('marks failures as terminal but still runs cleanup and queue handoff', async () => {
    const event = createEvent({
      payload: {
        callStack: ['tool_a'],
        depth: 1,
        input: 'hello',
        parentRunId: 'wrun_parent',
        parentToolCallId: 'tool_call_123',
        parentToolId: 'tool_123',
        streamToken: 'stream_123',
      },
      type: 'invocation',
    })

    mockLoadAgentEventStep.mockResolvedValue(event)
    mockHandleInvocation.mockRejectedValue(new Error('tool exploded'))

    await expect(agentEventWorkflow({ eventId: event.id })).rejects.toThrow(
      'tool exploded'
    )

    expect(mockMarkAgentEventTerminalStep).toHaveBeenCalledWith({
      eventId: event.id,
      lastError: 'tool exploded',
      status: 'failed',
    })
    expect(mockCleanupEventResources).toHaveBeenCalledWith({
      agentId: 'agent_123',
    })
    expect(mockStartNextQueuedEvent).toHaveBeenCalledWith({
      concurrencyKey: 'key_123',
    })
  })
})
