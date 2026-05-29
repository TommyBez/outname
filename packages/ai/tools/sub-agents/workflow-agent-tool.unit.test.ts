import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  getCapturedDispatch,
  mockBuildAgentToolCore,
  mockDispatchInvocation,
  mockGetWorkflowMetadata,
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
    mockGetWorkflowMetadata: vi.fn(),
    mockStart: vi.fn(),
  }
})

vi.mock('workflow', () => ({
  getWorkflowMetadata: mockGetWorkflowMetadata,
}))

vi.mock('workflow/api', () => ({
  start: mockStart,
}))

vi.mock('@outname/ai/agent-runtime/server/agent-invocation-events', () => ({
  dispatchInvocation: mockDispatchInvocation,
}))

vi.mock('./agent-tool', () => ({
  buildAgentToolCore: mockBuildAgentToolCore,
}))

import { buildWorkflowAgentTool } from './workflow-agent-tool'

describe('buildWorkflowAgentTool', () => {
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
    mockGetWorkflowMetadata.mockReturnValue({
      workflowName: 'agentEventWorkflow',
    })
  })

  it('wires the workflow dispatch implementation into the shared tool builder', () => {
    const built = buildWorkflowAgentTool(handle)

    expect(built).toEqual({ built: true })
    expect(mockBuildAgentToolCore).toHaveBeenCalledWith(
      handle,
      expect.any(Function)
    )
  })

  it('starts child runs through the current workflow name before returning the session run id', async () => {
    buildWorkflowAgentTool(handle)
    const dispatch = getCapturedDispatch()
    expect(dispatch).toBeTypeOf('function')
    if (!dispatch) {
      throw new Error(
        'Expected buildWorkflowAgentTool to capture a dispatch function'
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
    expect(mockStart).toHaveBeenCalledWith(
      { workflowId: 'agentEventWorkflow' },
      [{ eventId: 'evt_child' }]
    )
  })
})
