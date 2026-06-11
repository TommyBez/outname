import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockCurrentToolRuntimeRunId,
  mockDbLimit,
  mockDbSelect,
  mockEq,
  mockGetToolSandboxManifest,
  mockSandboxCreate,
  mockToolRuntimeSandboxTags,
  mockWithVercelSandboxCredentials,
} = vi.hoisted(() => {
  const mockDbLimit = vi.fn()
  const mockDbWhere = vi.fn(() => ({ limit: mockDbLimit }))
  const mockDbFrom = vi.fn(() => ({ where: mockDbWhere }))
  const mockDbSelect = vi.fn(() => ({ from: mockDbFrom }))

  return {
    mockCurrentToolRuntimeRunId: vi.fn(),
    mockDbLimit,
    mockDbSelect,
    mockEq: vi.fn((left: unknown, right: unknown) => ({
      kind: 'eq',
      left,
      right,
    })),
    mockGetToolSandboxManifest: vi.fn(),
    mockSandboxCreate: vi.fn(),
    mockToolRuntimeSandboxTags: vi.fn(),
    mockWithVercelSandboxCredentials: vi.fn((options) => ({
      ...options,
      projectId: 'prj_test',
      teamId: 'team_test',
      token: 'token_test',
    })),
  }
})

vi.mock('server-only', () => ({}))

vi.mock('drizzle-orm', () => ({
  eq: mockEq,
}))

vi.mock('@vercel/sandbox', () => ({
  Sandbox: {
    create: mockSandboxCreate,
  },
}))

vi.mock('@outname/ai/tools/runtime/run-id', () => ({
  currentToolRuntimeRunId: mockCurrentToolRuntimeRunId,
}))

vi.mock('@outname/ai/tools/sandboxes/registry', () => ({
  getToolSandboxManifest: mockGetToolSandboxManifest,
}))

vi.mock('@outname/db', () => ({
  db: {
    select: mockDbSelect,
  },
}))

vi.mock('@outname/db/schema', () => ({
  toolSandboxSnapshots: {
    manifestId: 'toolSandboxSnapshots.manifestId',
    snapshotId: 'toolSandboxSnapshots.snapshotId',
  },
}))

vi.mock('@outname/shared/server/vercel-sandbox-config', () => ({
  toolRuntimeSandboxTags: mockToolRuntimeSandboxTags,
  withVercelSandboxCredentials: mockWithVercelSandboxCredentials,
}))

vi.mock('@outname/shared/server/workflow-step-errors', () => ({
  nonRetryableStepError: (message: string) => new Error(message),
  nonRetryableStepErrorFromUnknown: (error: unknown, context: string) =>
    new Error(
      `${context}: ${error instanceof Error ? error.message : String(error)}`
    ),
}))

import { getOrStartToolSandbox, stopAllToolSandboxesForRun } from './runtime'

let currentRunId = 'run_test'
let runCounter = 0

function createRuntimeSandbox(input?: { delete?: ReturnType<typeof vi.fn> }) {
  return {
    delete: input?.delete ?? vi.fn(async () => undefined),
    runCommand: vi.fn(),
  }
}

describe('tool sandbox runtime cleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    runCounter += 1
    currentRunId = `run_test_${runCounter}`
    mockCurrentToolRuntimeRunId.mockImplementation(() => currentRunId)
    mockDbLimit.mockResolvedValue([{ snapshotId: 'snap_123' }])
    mockGetToolSandboxManifest.mockReturnValue({})
    mockToolRuntimeSandboxTags.mockImplementation((input) => input)
  })

  it('deletes cached runtime sandboxes and clears the run cache', async () => {
    const firstSandbox = createRuntimeSandbox()
    const secondSandbox = createRuntimeSandbox()
    mockSandboxCreate
      .mockResolvedValueOnce(firstSandbox)
      .mockResolvedValueOnce(secondSandbox)

    const firstHandle = await getOrStartToolSandbox('manifest_123')
    const cachedHandle = await getOrStartToolSandbox('manifest_123')

    expect(firstHandle).toBe(firstSandbox)
    expect(cachedHandle).toBe(firstSandbox)
    expect(mockSandboxCreate).toHaveBeenCalledTimes(1)
    expect(mockSandboxCreate).toHaveBeenCalledWith({
      persistent: false,
      projectId: 'prj_test',
      source: { snapshotId: 'snap_123', type: 'snapshot' },
      tags: {
        manifestId: 'manifest_123',
        runId: currentRunId,
      },
      teamId: 'team_test',
      timeout: 600_000,
      token: 'token_test',
    })

    await stopAllToolSandboxesForRun()

    expect(firstSandbox.delete).toHaveBeenCalledTimes(1)

    const nextHandle = await getOrStartToolSandbox('manifest_123')

    expect(nextHandle).toBe(secondSandbox)
    expect(mockSandboxCreate).toHaveBeenCalledTimes(2)
  })

  it('logs delete failures and still clears the run cache', async () => {
    const deleteError = new Error('delete failed')
    const firstSandbox = createRuntimeSandbox({
      delete: vi.fn().mockRejectedValue(deleteError),
    })
    const secondSandbox = createRuntimeSandbox()
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    mockSandboxCreate
      .mockResolvedValueOnce(firstSandbox)
      .mockResolvedValueOnce(secondSandbox)

    try {
      await getOrStartToolSandbox('manifest_123')

      await expect(stopAllToolSandboxesForRun()).resolves.toBeUndefined()

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'stopAllToolSandboxesForRun: delete failed',
        'manifest_123',
        deleteError
      )

      const nextHandle = await getOrStartToolSandbox('manifest_123')

      expect(nextHandle).toBe(secondSandbox)
      expect(mockSandboxCreate).toHaveBeenCalledTimes(2)
    } finally {
      consoleErrorSpy.mockRestore()
    }
  })
})
