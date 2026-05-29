import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { mockGetWorkflowMetadata } = vi.hoisted(() => ({
  mockGetWorkflowMetadata: vi.fn(),
}))

vi.mock('workflow', () => ({
  getWorkflowMetadata: mockGetWorkflowMetadata,
}))

vi.mock('server-only', () => ({}))

type RuntimeRunIdGlobal = typeof globalThis & {
  __outnameToolRuntimeRunIdGetter?: () => string | undefined
}

describe('currentToolRuntimeRunId', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  afterEach(() => {
    ;(globalThis as RuntimeRunIdGlobal).__outnameToolRuntimeRunIdGetter =
      undefined
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

  it('prefers realtime ALS run id over workflow metadata', async () => {
    mockGetWorkflowMetadata.mockReturnValue({
      workflowRunId: 'wrun_123',
    })

    const { currentToolRuntimeRunId } = await import('./run-id')
    const { withToolRuntimeRunId } = await import('./realtime-run-id')

    await withToolRuntimeRunId('rt_123', async () => {
      await Promise.resolve()
      expect(currentToolRuntimeRunId()).toBe('rt_123')
    })
    expect(currentToolRuntimeRunId()).toBe('wrun_123')
  })

  it('isolates concurrent realtime run ids', async () => {
    mockGetWorkflowMetadata.mockImplementation(() => {
      throw new Error('outside workflow runtime')
    })

    const { currentToolRuntimeRunId } = await import('./run-id')
    const { withToolRuntimeRunId } = await import('./realtime-run-id')

    await Promise.all([
      withToolRuntimeRunId('rt_a', async () => {
        await Promise.resolve()
        expect(currentToolRuntimeRunId()).toBe('rt_a')
      }),
      withToolRuntimeRunId('rt_b', async () => {
        await Promise.resolve()
        expect(currentToolRuntimeRunId()).toBe('rt_b')
      }),
    ])
  })
})
