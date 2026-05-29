import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockBuildWorkflowAgentTool,
  mockCleanupEventResources,
  mockGetWorkflowMetadata,
  mockHandleHeartbeat,
  mockHandleInvocation,
  mockLoadAgentEventStep,
  mockMarkAgentEventHeartbeatStep,
  mockMarkAgentEventRunningStep,
  mockMarkAgentEventTerminalStep,
  mockStart,
  mockStartNextQueuedEventForWorkflow,
} = vi.hoisted(() => ({
  mockBuildWorkflowAgentTool: vi.fn((_handle: unknown) => ({ built: true })),
  mockCleanupEventResources: vi.fn(),
  mockGetWorkflowMetadata: vi.fn(),
  mockHandleHeartbeat: vi.fn(),
  mockHandleInvocation: vi.fn(),
  mockLoadAgentEventStep: vi.fn(),
  mockMarkAgentEventHeartbeatStep: vi.fn(),
  mockMarkAgentEventRunningStep: vi.fn(),
  mockMarkAgentEventTerminalStep: vi.fn(),
  mockStart: vi.fn(),
  mockStartNextQueuedEventForWorkflow: vi.fn(),
}))

vi.mock('workflow', () => ({
  getWorkflowMetadata: mockGetWorkflowMetadata,
}))

vi.mock('workflow/api', () => ({
  start: mockStart,
}))

vi.mock('server-only', () => ({}))

vi.mock('@outname/ai/tools/sub-agents/workflow-agent-tool', () => ({
  buildWorkflowAgentTool: mockBuildWorkflowAgentTool,
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
}))

vi.mock('./steps/start-next-queued-event', () => ({
  startNextQueuedEventForWorkflow: mockStartNextQueuedEventForWorkflow,
}))

import { agentEventWorkflow, startNextQueuedEvent } from './workflow'

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
    userId: 'user_123',
    workflowRunId: null,
    ...overrides,
  }
}

function createHandle() {
  return {
    childAgentId: 'agent_child',
    childCapabilitySummary: null,
    childName: 'Child Agent',
    childUserId: 'user_123',
    parentAgentId: 'agent_parent',
    parentCallStack: ['agent_root'],
    parentDepth: 2,
    parentRunId: 'wrun_parent',
    parentToolId: 'tool_sub_agent',
    parentUserId: 'user_123',
    progressTarget: { kind: 'none' } as const,
  }
}

describe('agentEventWorkflow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetWorkflowMetadata.mockReturnValue({
      workflowRunId: 'wrun_runtime',
    })
  })

  it('returns early when the event record is gone', async () => {
    mockLoadAgentEventStep.mockResolvedValue(null)

    await agentEventWorkflow({ eventId: 'evt_missing' })

    expect(mockMarkAgentEventRunningStep).not.toHaveBeenCalled()
    expect(mockCleanupEventResources).not.toHaveBeenCalled()
    expect(mockStartNextQueuedEventForWorkflow).not.toHaveBeenCalled()
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
      buildSubAgentTool: expect.any(Function),
      eventId: 'evt_123',
      manual: true,
      mode: 'normal',
      replyToken: 'reply:evt_123',
      scheduledAt: '2026-05-14T20:30:00.000Z',
      userId: 'user_123',
    })
    expect(mockMarkAgentEventTerminalStep).toHaveBeenCalledWith({
      eventId: event.id,
      status: 'completed',
    })
    expect(mockCleanupEventResources).toHaveBeenCalledWith({
      agentId: 'agent_123',
    })
    expect(mockStartNextQueuedEventForWorkflow).toHaveBeenCalledWith({
      concurrencyKey: 'key_123',
      startWorkflowRun: expect.any(Function),
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
      buildSubAgentTool: expect.any(Function),
      eventId: 'evt_123',
      localDate: '2026-05-14',
      manual: false,
      mode: 'dreaming',
      replyToken: 'reply:evt_123',
      scheduledAt: '2026-05-14T20:30:00.000Z',
      userId: 'user_123',
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
      buildSubAgentTool: expect.any(Function),
      callStack: ['tool_a'],
      depth: 2,
      eventId: 'evt_123',
      input: 'hello',
      parentRunId: null,
      parentStream: null,
      parentToolCallId: null,
      parentToolId: null,
      replyToken: 'reply:evt_123',
      streamToken: 'stream_123',
      userId: 'user_123',
    })
  })

  it('passes the pre-PR workflow sub-agent builder to invocation handlers', async () => {
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

    const workflowInput = mockHandleInvocation.mock.calls[0]?.[0]
    const buildSubAgentTool = workflowInput?.buildSubAgentTool
    expect(buildSubAgentTool).toBe(mockBuildWorkflowAgentTool)

    const handle = createHandle()
    expect(mockBuildWorkflowAgentTool(handle)).toEqual({ built: true })
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
    expect(mockStartNextQueuedEventForWorkflow).toHaveBeenCalledWith({
      concurrencyKey: 'key_123',
      startWorkflowRun: expect.any(Function),
    })
  })
})

describe('startNextQueuedEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('skips queue-start logic when there is no concurrency key', async () => {
    await startNextQueuedEvent({ concurrencyKey: null })

    expect(mockStartNextQueuedEventForWorkflow).not.toHaveBeenCalled()
  })

  it('starts the next queued event for the same concurrency key', async () => {
    mockStart.mockResolvedValue({ runId: 'wrun_next' })
    mockStartNextQueuedEventForWorkflow.mockImplementationOnce(
      async (input: {
        startWorkflowRun: (eventId: string) => Promise<string>
      }) => {
        await expect(input.startWorkflowRun('evt_next')).resolves.toBe(
          'wrun_next'
        )
      }
    )

    await startNextQueuedEvent({ concurrencyKey: 'key_123' })

    expect(mockStartNextQueuedEventForWorkflow).toHaveBeenCalledWith({
      concurrencyKey: 'key_123',
      startWorkflowRun: expect.any(Function),
    })
    expect(mockStart).toHaveBeenCalledWith(agentEventWorkflow, [
      { eventId: 'evt_next' },
    ])
  })
})
