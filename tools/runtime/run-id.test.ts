import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { mockGetWorkflowMetadata } = vi.hoisted(() => ({
  mockGetWorkflowMetadata: vi.fn(),
}))

vi.mock('workflow', () => ({
  getWorkflowMetadata: mockGetWorkflowMetadata,
}))

describe('currentToolRuntimeRunId', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns workflowRunId when workflow metadata is available', async () => {
    mockGetWorkflowMetadata.mockReturnValue({
      workflowRunId: 'wrun_123',
    })

    const { currentToolRuntimeRunId } = await import('./run-id')

    expect(currentToolRuntimeRunId()).toBe('wrun_123')
  })

  it('falls back to a stable standalone id outside workflow runtime', async () => {
    mockGetWorkflowMetadata.mockImplementation(() => {
      throw new Error('outside workflow runtime')
    })

    const randomUuidSpy = vi
      .spyOn(crypto, 'randomUUID')
      .mockReturnValue('uuid_123')

    const { currentToolRuntimeRunId } = await import('./run-id')

    expect(currentToolRuntimeRunId()).toBe('standalone-uuid_123')
    expect(currentToolRuntimeRunId()).toBe('standalone-uuid_123')
    expect(randomUuidSpy).toHaveBeenCalledTimes(1)
  })
})
