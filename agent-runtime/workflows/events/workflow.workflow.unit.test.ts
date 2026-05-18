import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockGetWorkflowMetadata,
  mockHandleChat,
  mockHandleHeartbeat,
  mockHandleInvocation,
  mockCleanupEventResources,
  mockLoadAgentEventStep,
  mockMarkAgentEventHeartbeatStep,
  mockMarkAgentEventRunningStep,
  mockMarkAgentEventTerminalStep,
  mockSetAgentEventPublisherWorkflowRunIdStep,
  mockStart,
  mockStartNextQueuedEvent,
  mockSlackStreamForwarderWorkflow,
} = vi.hoisted(() => ({
  mockGetWorkflowMetadata: vi.fn(),
  mockHandleChat: vi.fn(),
  mockHandleHeartbeat: vi.fn(),
  mockHandleInvocation: vi.fn(),
  mockCleanupEventResources: vi.fn(),
  mockLoadAgentEventStep: vi.fn(),
  mockMarkAgentEventHeartbeatStep: vi.fn(),
  mockMarkAgentEventRunningStep: vi.fn(),
  mockMarkAgentEventTerminalStep: vi.fn(),
  mockSetAgentEventPublisherWorkflowRunIdStep: vi.fn(),
  mockStart: vi.fn(),
  mockStartNextQueuedEvent: vi.fn(),
  mockSlackStreamForwarderWorkflow: {
    name: 'slackStreamForwarderWorkflow',
  },
}))

vi.mock('workflow', () => ({
  getWorkflowMetadata: mockGetWorkflowMetadata,
}))

vi.mock('workflow/api', () => ({
  start: mockStart,
}))

vi.mock('@/channels/slack/server/stream-forwarder-workflow', () => ({
  slackStreamForwarderWorkflow: mockSlackStreamForwarderWorkflow,
}))

vi.mock('../session/handlers/handle-chat', () => ({
  handleChat: mockHandleChat,
}))

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
  setAgentEventPublisherWorkflowRunIdStep:
    mockSetAgentEventPublisherWorkflowRunIdStep,
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
    mockGetWorkflowMetadata.mockReturnValue({})
  })

  it('returns early when the event record is gone', async () => {
    mockLoadAgentEventStep.mockResolvedValue(null)

    await agentEventWorkflow({ eventId: 'evt_missing' })

    expect(mockMarkAgentEventRunningStep).not.toHaveBeenCalled()
    expect(mockCleanupEventResources).not.toHaveBeenCalled()
    expect(mockStartNextQueuedEvent).not.toHaveBeenCalled()
  })

  it('completes Slack chat events and starts the publisher workflow once', async () => {
    const event = createEvent({
      payload: {
        conversationId: 'conv_123',
        slack: {
          channelId: 'C123',
          recipientUserId: 'U123',
          teamId: 'T123',
          threadTs: '1715718300.000100',
        },
        uiMessages: [{ id: 'msg_1', parts: [], role: 'user' }],
      },
      source: 'slack',
      status: 'running',
      type: 'chat',
      workflowRunId: 'wrun_saved',
    })

    mockGetWorkflowMetadata.mockReturnValue({
      runId: 'wrun_runtime',
    })
    mockLoadAgentEventStep.mockResolvedValue(event)
    mockStart.mockResolvedValue({
      runId: 'wrun_publisher',
    })

    await agentEventWorkflow({ eventId: event.id })

    expect(mockMarkAgentEventRunningStep).toHaveBeenCalledWith({
      eventId: event.id,
      workflowRunId: 'wrun_runtime',
    })
    expect(mockStart).toHaveBeenCalledWith(mockSlackStreamForwarderWorkflow, [
      {
        channelId: 'C123',
        eventId: event.id,
        recipientUserId: 'U123',
        replyNamespace: 'reply:evt_123',
        teamId: 'T123',
        threadTs: '1715718300.000100',
        workflowRunId: 'wrun_runtime',
      },
    ])
    expect(mockSetAgentEventPublisherWorkflowRunIdStep).toHaveBeenCalledWith({
      eventId: event.id,
      publisherWorkflowRunId: 'wrun_publisher',
    })
    expect(mockMarkAgentEventHeartbeatStep).toHaveBeenCalledWith({
      eventId: event.id,
    })
    expect(mockHandleChat).toHaveBeenCalledWith({
      agentId: 'agent_123',
      conversationId: 'conv_123',
      replyToken: 'reply:evt_123',
      uiMessages: [{ id: 'msg_1', parts: [], role: 'user' }],
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

  it('falls back to the persisted workflow run id when metadata omits run ids', async () => {
    const event = createEvent({
      payload: {
        manual: true,
        scheduledAt: '2026-05-14T20:30:00.000Z',
      },
      status: 'running',
      type: 'heartbeat',
      workflowRunId: 'wrun_saved',
    })

    mockGetWorkflowMetadata.mockReturnValue({})
    mockLoadAgentEventStep.mockResolvedValue(event)

    await agentEventWorkflow({ eventId: event.id })

    expect(mockMarkAgentEventRunningStep).toHaveBeenCalledWith({
      eventId: event.id,
      workflowRunId: 'wrun_saved',
    })
    expect(mockHandleHeartbeat).toHaveBeenCalledWith({
      agentId: 'agent_123',
      manual: true,
      mode: 'normal',
      replyToken: 'reply:evt_123',
      scheduledAt: '2026-05-14T20:30:00.000Z',
    })
    expect(mockStart).not.toHaveBeenCalled()
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
