import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockEmitBuildEvent,
  mockLoadBuildRow,
  mockMarkBuildFailed,
  mockMarkBuildReady,
  mockMarkBuildRunning,
  mockReadManifestSetupScript,
  mockRunSandboxBuild,
} = vi.hoisted(() => ({
  mockEmitBuildEvent: vi.fn(),
  mockLoadBuildRow: vi.fn(),
  mockMarkBuildFailed: vi.fn(),
  mockMarkBuildReady: vi.fn(),
  mockMarkBuildRunning: vi.fn(),
  mockReadManifestSetupScript: vi.fn(),
  mockRunSandboxBuild: vi.fn(),
}))

vi.mock('./steps/db-steps', () => ({
  loadBuildRow: mockLoadBuildRow,
  markBuildFailed: mockMarkBuildFailed,
  markBuildReady: mockMarkBuildReady,
  markBuildRunning: mockMarkBuildRunning,
  readManifestSetupScript: mockReadManifestSetupScript,
}))

vi.mock('./steps/emit-build-event', () => ({
  emitBuildEvent: mockEmitBuildEvent,
}))

vi.mock('./steps/run-sandbox-build', () => ({
  runSandboxBuild: mockRunSandboxBuild,
}))

import { buildToolSandboxWorkflow } from './workflow'

describe('buildToolSandboxWorkflow', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-14T20:30:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('runs the happy path and emits a ready event', async () => {
    mockLoadBuildRow.mockResolvedValue({
      manifestHash: 'hash_123',
      manifestId: 'manifest_123',
    })
    mockReadManifestSetupScript.mockResolvedValue({
      setup: 'echo ready',
    })
    mockRunSandboxBuild.mockResolvedValue({
      snapshotId: 'snap_123',
    })

    await buildToolSandboxWorkflow({ buildId: 'build_123' })

    expect(mockMarkBuildRunning).toHaveBeenCalledWith({ buildId: 'build_123' })
    expect(mockLoadBuildRow).toHaveBeenCalledWith({ buildId: 'build_123' })
    expect(mockReadManifestSetupScript).toHaveBeenCalledWith({
      manifestId: 'manifest_123',
    })
    expect(mockRunSandboxBuild).toHaveBeenCalledWith({
      buildId: 'build_123',
      manifestId: 'manifest_123',
      setup: 'echo ready',
    })
    expect(mockMarkBuildReady).toHaveBeenCalledWith({
      buildId: 'build_123',
      manifestHash: 'hash_123',
      manifestId: 'manifest_123',
      snapshotId: 'snap_123',
    })
    expect(mockEmitBuildEvent).toHaveBeenCalledWith({
      buildId: 'build_123',
      event: {
        snapshotId: 'snap_123',
        ts: '2026-05-14T20:30:00.000Z',
        type: 'ready',
      },
    })
    expect(mockMarkBuildFailed).not.toHaveBeenCalled()
  })

  it('marks the build failed, emits a failure event, and rethrows', async () => {
    const buildError = new Error('sandbox crashed')

    mockLoadBuildRow.mockResolvedValue({
      manifestHash: 'hash_123',
      manifestId: 'manifest_123',
    })
    mockReadManifestSetupScript.mockResolvedValue({
      setup: 'echo ready',
    })
    mockRunSandboxBuild.mockRejectedValue(buildError)

    await expect(
      buildToolSandboxWorkflow({ buildId: 'build_123' })
    ).rejects.toThrow('sandbox crashed')

    expect(mockMarkBuildFailed).toHaveBeenCalledWith({
      buildId: 'build_123',
      error: 'sandbox crashed',
    })
    expect(mockEmitBuildEvent).toHaveBeenCalledWith({
      buildId: 'build_123',
      event: {
        error: 'sandbox crashed',
        ts: '2026-05-14T20:30:00.000Z',
        type: 'failed',
      },
    })
  })

  it('keeps reporting the original failure if marking the build failed also breaks', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    const buildError = new Error('sandbox crashed')
    const markFailedError = new Error('db unavailable')

    mockLoadBuildRow.mockResolvedValue({
      manifestHash: 'hash_123',
      manifestId: 'manifest_123',
    })
    mockReadManifestSetupScript.mockResolvedValue({
      setup: 'echo ready',
    })
    mockRunSandboxBuild.mockRejectedValue(buildError)
    mockMarkBuildFailed.mockRejectedValue(markFailedError)

    await expect(
      buildToolSandboxWorkflow({ buildId: 'build_123' })
    ).rejects.toThrow('sandbox crashed')

    expect(consoleError).toHaveBeenCalledWith(
      'buildToolSandboxWorkflow: markBuildFailed failed',
      markFailedError
    )
    expect(mockEmitBuildEvent).toHaveBeenCalledWith({
      buildId: 'build_123',
      event: {
        error: 'sandbox crashed',
        ts: '2026-05-14T20:30:00.000Z',
        type: 'failed',
      },
    })
  })
})
