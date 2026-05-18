import { describe, expect, it, vi } from 'vitest'

const { mockGetWorkflowMetadata } = vi.hoisted(() => ({
  mockGetWorkflowMetadata: vi.fn(),
}))

vi.mock('workflow', () => ({
  getWorkflowMetadata: mockGetWorkflowMetadata,
}))

import { beginInvocationRun } from './run-helpers'

describe('beginInvocationRun', () => {
  it('returns the active workflow run id', async () => {
    mockGetWorkflowMetadata.mockReturnValue({
      workflowRunId: 'wrun_active',
    })

    await expect(
      beginInvocationRun({
        agentId: 'agent_123',
        parentRunId: null,
        parentToolId: null,
        streamToken: 'stream_123',
      })
    ).resolves.toBe('wrun_active')
  })

  it('falls back to the stream token when metadata omits run ids', async () => {
    mockGetWorkflowMetadata.mockReturnValue({})

    await expect(
      beginInvocationRun({
        agentId: 'agent_123',
        parentRunId: null,
        parentToolId: null,
        streamToken: 'stream_123',
      })
    ).resolves.toBe('stream_123')
  })
})
