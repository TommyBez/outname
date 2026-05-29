import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  getCapturedDispatch,
  mockBuildAgentToolCore,
  mockDispatchInvocation,
  mockStart,
} = vi.hoisted(() => {
  let capturedDispatch:
    | ((input: unknown) => Promise<{ sessionRunId: string }>)
    | null = null

  return {
    getCapturedDispatch: () => capturedDispatch,
    mockBuildAgentToolCore: vi.fn(
      (
        _handle: unknown,
        dispatch: (input: unknown) => Promise<{ sessionRunId: string }>
      ) => {
        capturedDispatch = dispatch
        return { built: true }
      }
    ),
    mockDispatchInvocation: vi.fn(),
    mockStart: vi.fn(),
  }
})

vi.mock('workflow/api', () => ({
  start: mockStart,
}))

vi.mock('@/agent-runtime/workflows/events/workflow', () => ({
  agentEventWorkflow: 'mock-agent-event-workflow',
}))

vi.mock('@/agent-runtime/server/agent-invocation-events', () => ({
  dispatchInvocation: mockDispatchInvocation,
}))

vi.mock('./agent-tool', () => ({
  buildAgentToolCore: mockBuildAgentToolCore,
}))

import { buildRealtimeAgentTool } from './realtime-agent-tool'

describe('buildRealtimeAgentTool', () => {
  const handle = {
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

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('wires the realtime dispatch implementation into the shared tool builder', () => {
    const built = buildRealtimeAgentTool(handle)

    expect(built).toEqual({ built: true })
    expect(mockBuildAgentToolCore).toHaveBeenCalledWith(
      handle,
      expect.any(Function)
    )
  })

  it('starts child runs through agentEventWorkflow before returning the session run id', async () => {
    buildRealtimeAgentTool(handle)
    const dispatch = getCapturedDispatch()
    expect(dispatch).toBeTypeOf('function')
    if (!dispatch) {
      throw new Error(
        'Expected buildRealtimeAgentTool to capture a dispatch function'
      )
    }

    mockStart.mockResolvedValue({ runId: 'wrun_child' })
    mockDispatchInvocation.mockImplementation(
      async (input: {
        startWorkflowRun: (eventId: string) => Promise<string>
      }) => {
        const runId = await input.startWorkflowRun('evt_child')
        expect(runId).toBe('wrun_child')
        return { eventId: 'evt_child', sessionRunId: 'wrun_child' }
      }
    )

    await expect(
      dispatch({
        handle,
        instruction: 'Do the task',
        streamToken: 'stream_child',
        toolCallId: 'tool_call_123',
      })
    ).resolves.toMatchObject({ sessionRunId: 'wrun_child' })

    expect(mockDispatchInvocation).toHaveBeenCalledWith(
      expect.objectContaining({
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
        startWorkflowRun: expect.any(Function),
      })
    )
    expect(mockStart).toHaveBeenCalledWith('mock-agent-event-workflow', [
      { eventId: 'evt_child' },
    ])
  })
})
