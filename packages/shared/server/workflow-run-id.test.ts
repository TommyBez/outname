import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockGetWorkflowMetadata } = vi.hoisted(() => ({
  mockGetWorkflowMetadata: vi.fn(),
}))

vi.mock('workflow', () => ({
  getWorkflowMetadata: mockGetWorkflowMetadata,
}))

vi.mock('server-only', () => ({}))

import { currentWorkflowRunId } from './workflow-run-id'

describe('currentWorkflowRunId', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns workflowRunId from the workflow runtime metadata', () => {
    mockGetWorkflowMetadata.mockReturnValue({
      workflowRunId: 'wrun_123',
    })

    expect(currentWorkflowRunId()).toBe('wrun_123')
  })

  it('propagates workflow runtime errors', () => {
    const error = new Error('outside workflow runtime')
    mockGetWorkflowMetadata.mockImplementation(() => {
      throw error
    })

    expect(() => currentWorkflowRunId()).toThrow(error)
  })
})
