import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockAnd,
  mockDbLimit,
  mockDbSelect,
  mockDelayedRetryStepError,
  mockEnqueueAgentEventWithStarter,
  mockEq,
  mockNonRetryableStepError,
} = vi.hoisted(() => {
  const mockDbLimit = vi.fn()
  const mockDbWhere = vi.fn(() => ({ limit: mockDbLimit }))
  const mockDbFrom = vi.fn(() => ({ where: mockDbWhere }))
  const mockDbSelect = vi.fn(() => ({ from: mockDbFrom }))

  return {
    mockAnd: vi.fn((...args: unknown[]) => ({ args, kind: 'and' })),
    mockDbFrom,
    mockDbLimit,
    mockDbSelect,
    mockDbWhere,
    mockDelayedRetryStepError: vi.fn(
      (message: string, options: { retryAfter: string }) => {
        const error = new Error(message) as Error & { retryAfter?: string }
        error.retryAfter = options.retryAfter
        return error
      }
    ),
    mockEnqueueAgentEventWithStarter: vi.fn(),
    mockEq: vi.fn((left: unknown, right: unknown) => ({
      kind: 'eq',
      left,
      right,
    })),
    mockNonRetryableStepError: vi.fn((message: string) => new Error(message)),
  }
})

vi.mock('drizzle-orm', () => ({
  and: mockAnd,
  eq: mockEq,
}))

vi.mock('server-only', () => ({}))

vi.mock('@/agent-runtime/server/agent-event-start', () => ({
  enqueueAgentEventWithStarter: mockEnqueueAgentEventWithStarter,
}))

vi.mock('@/shared/db', () => ({
  db: {
    select: mockDbSelect,
  },
}))

vi.mock('@/shared/db/schema', () => ({
  agent: {
    id: 'agent.id',
    userId: 'agent.userId',
  },
}))

vi.mock('@/shared/server/workflow-step-errors', () => ({
  delayedRetryStepError: mockDelayedRetryStepError,
  nonRetryableStepError: mockNonRetryableStepError,
}))

import { dispatchInvocation } from './agent-invocation-events'

describe('dispatchInvocation', () => {
  const startWorkflowRun = vi.fn(async (eventId: string) => `wrun:${eventId}`)

  beforeEach(() => {
    vi.clearAllMocks()
    mockDbLimit.mockResolvedValue([
      {
        enabled: true,
        id: 'agent_child',
        userId: 'user_123',
      },
    ])
  })

  it('passes the injected starter through enqueue and returns the started session run id', async () => {
    mockEnqueueAgentEventWithStarter.mockResolvedValue({
      eventId: 'evt_child',
      workflowRunId: 'wrun:evt_child',
    })

    await expect(
      dispatchInvocation({
        childAgentId: 'agent_child',
        childUserId: 'user_123',
        parentUserId: 'user_123',
        parentRunId: 'wrun_parent',
        parentToolId: 'tool_sub_agent',
        parentToolCallId: 'tool_call_123',
        instruction: 'Do the task',
        streamToken: 'stream_child',
        callStack: ['agent_root', 'agent_parent'],
        depth: 3,
        startWorkflowRun,
      })
    ).resolves.toEqual({
      eventId: 'evt_child',
      sessionRunId: 'wrun:evt_child',
    })

    expect(mockDbSelect).toHaveBeenCalledTimes(1)
    expect(mockDbLimit).toHaveBeenCalledWith(1)
    expect(mockEnqueueAgentEventWithStarter).toHaveBeenCalledWith(
      expect.objectContaining({
        agent: {
          enabled: true,
          id: 'agent_child',
          userId: 'user_123',
        },
        idempotencyKey: 'invocation:agent_child:wrun_parent:tool_call_123',
        payload: {
          callStack: ['agent_root', 'agent_parent'],
          depth: 3,
          input: 'Do the task',
          parentRunId: 'wrun_parent',
          parentToolCallId: 'tool_call_123',
          parentToolId: 'tool_sub_agent',
          streamToken: 'stream_child',
        },
        source: 'invocation',
        type: 'invocation',
      }),
      startWorkflowRun
    )
  })

  it('throws a delayed retry error when enqueue returns without a workflow run id', async () => {
    mockEnqueueAgentEventWithStarter.mockResolvedValue({
      eventId: 'evt_child',
      workflowRunId: null,
    })

    await expect(
      dispatchInvocation({
        childAgentId: 'agent_child',
        childUserId: 'user_123',
        parentUserId: 'user_123',
        parentRunId: 'wrun_parent',
        parentToolId: 'tool_sub_agent',
        parentToolCallId: 'tool_call_123',
        instruction: 'Do the task',
        streamToken: 'stream_child',
        callStack: ['agent_root', 'agent_parent'],
        depth: 3,
        startWorkflowRun,
      })
    ).rejects.toMatchObject({
      message:
        'Agent event evt_child was queued before a workflow run became available',
      retryAfter: '1s',
    })

    expect(mockDelayedRetryStepError).toHaveBeenCalledWith(
      'Agent event evt_child was queued before a workflow run became available',
      { retryAfter: '1s' }
    )
  })
})
