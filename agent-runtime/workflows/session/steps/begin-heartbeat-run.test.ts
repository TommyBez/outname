import { describe, expect, it, vi } from 'vitest'

const { mockGetWorkflowMetadata } = vi.hoisted(() => ({
  mockGetWorkflowMetadata: vi.fn(),
}))

vi.mock('workflow', () => ({
  getWorkflowMetadata: mockGetWorkflowMetadata,
}))

import { beginHeartbeatRun } from './begin-heartbeat-run'

describe('beginHeartbeatRun', () => {
  it('returns the active workflow run id', async () => {
    mockGetWorkflowMetadata.mockReturnValue({
      runId: 'wrun_active',
    })

    await expect(beginHeartbeatRun({ agentId: 'agent_123' })).resolves.toEqual({
      runId: 'wrun_active',
    })
  })

  it('falls back to the agent id when metadata omits run ids', async () => {
    mockGetWorkflowMetadata.mockReturnValue({})

    await expect(beginHeartbeatRun({ agentId: 'agent_123' })).resolves.toEqual({
      runId: 'agent_123',
    })
  })
})
