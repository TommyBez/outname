import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockSandboxCreate,
  mockGetToolSandboxManifest,
  mockGetWritable,
  mockToolBuildSandboxTags,
  mockWithVercelSandboxCredentials,
} = vi.hoisted(() => ({
  mockSandboxCreate: vi.fn(),
  mockGetToolSandboxManifest: vi.fn(),
  mockGetWritable: vi.fn(),
  mockToolBuildSandboxTags: vi.fn(),
  mockWithVercelSandboxCredentials: vi.fn((options) => ({
    ...options,
    projectId: 'prj_test',
    teamId: 'team_test',
    token: 'token_test',
  })),
}))

vi.mock('@vercel/sandbox', () => ({
  Sandbox: {
    create: mockSandboxCreate,
  },
}))

vi.mock('workflow', () => ({
  FatalError: class FatalError extends Error {
    fatal = true

    constructor(message: string) {
      super(message)
      this.name = 'FatalError'
    }
  },
  getWritable: mockGetWritable,
  RetryableError: class RetryableError extends Error {
    retryAfter: Date

    constructor(message: string) {
      super(message)
      this.name = 'RetryableError'
      this.retryAfter = new Date()
    }
  },
}))

vi.mock('server-only', () => ({}))

vi.mock('@outname/shared/server/vercel-sandbox-config', () => ({
  toolBuildSandboxTags: mockToolBuildSandboxTags,
  withVercelSandboxCredentials: mockWithVercelSandboxCredentials,
}))

vi.mock('@outname/ai/tools/sandboxes/registry', () => ({
  getToolSandboxManifest: mockGetToolSandboxManifest,
}))

import { emitBuildEvent } from './emit-build-event'
import { runSandboxBuild } from './run-sandbox-build'

describe('emitBuildEvent', () => {
  it('writes build events to the workflow stream', async () => {
    const releaseLock = vi.fn()
    const write = vi.fn().mockResolvedValue(undefined)

    mockGetWritable.mockReturnValue({
      getWriter: () => ({
        releaseLock,
        write,
      }),
    })

    await emitBuildEvent({
      buildId: 'build_123',
      event: {
        snapshotId: 'snap_123',
        ts: '2026-05-14T20:30:00.000Z',
        type: 'ready',
      },
    })

    expect(mockGetWritable).toHaveBeenCalledWith({
      namespace: 'tool-sandbox-build:build_123',
    })
    expect(write).toHaveBeenCalledWith({
      snapshotId: 'snap_123',
      ts: '2026-05-14T20:30:00.000Z',
      type: 'ready',
    })
    expect(releaseLock).toHaveBeenCalledTimes(1)
  })

  it('swallows streaming failures', async () => {
    mockGetWritable.mockImplementation(() => {
      throw new Error('stream offline')
    })

    await expect(
      emitBuildEvent({
        buildId: 'build_123',
        event: {
          error: 'broken',
          ts: '2026-05-14T20:30:00.000Z',
          type: 'failed',
        },
      })
    ).resolves.toBeUndefined()
  })
})

describe('runSandboxBuild', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-14T20:30:00.000Z'))

    mockGetToolSandboxManifest.mockReturnValue({
      build: {
        runtime: 'nodejs20.x',
        timeout: 600,
      },
    })
    mockToolBuildSandboxTags.mockReturnValue({
      buildId: 'build_123',
      manifestId: 'manifest_123',
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('creates a sandbox, emits progress, and snapshots the result', async () => {
    const releaseLock = vi.fn()
    const write = vi.fn().mockResolvedValue(undefined)
    const stop = vi.fn().mockResolvedValue(undefined)
    const snapshot = vi.fn().mockResolvedValue({
      snapshotId: 'snap_123',
    })
    const runCommand = vi.fn().mockResolvedValue({
      exitCode: 0,
      stderr: vi.fn().mockResolvedValue(''),
      stdout: vi.fn().mockResolvedValue('done'),
    })

    mockGetWritable.mockReturnValue({
      getWriter: () => ({
        releaseLock,
        write,
      }),
    })
    mockSandboxCreate.mockResolvedValue({
      runCommand,
      snapshot,
      stop,
    })

    await expect(
      runSandboxBuild({
        buildId: 'build_123',
        manifestId: 'manifest_123',
        setup: 'echo ok',
      })
    ).resolves.toEqual({
      snapshotId: 'snap_123',
    })

    expect(mockSandboxCreate).toHaveBeenCalledWith({
      persistent: false,
      projectId: 'prj_test',
      resources: { vcpus: 2 },
      runtime: 'nodejs20.x',
      tags: {
        buildId: 'build_123',
        manifestId: 'manifest_123',
      },
      teamId: 'team_test',
      timeout: 600,
      token: 'token_test',
    })
    expect(runCommand).toHaveBeenCalledWith({
      args: ['-c', 'echo ok'],
      cmd: 'bash',
    })
    expect(write).toHaveBeenNthCalledWith(1, {
      message: 'Creating build sandbox...',
      ts: '2026-05-14T20:30:00.000Z',
      type: 'progress',
    })
    expect(write).toHaveBeenNthCalledWith(2, {
      message: 'Installing system dependencies...',
      ts: '2026-05-14T20:30:00.000Z',
      type: 'progress',
    })
    expect(write).toHaveBeenNthCalledWith(3, {
      message: 'Capturing snapshot...',
      ts: '2026-05-14T20:30:00.000Z',
      type: 'progress',
    })
    expect(releaseLock).toHaveBeenCalledTimes(3)
    expect(snapshot).toHaveBeenCalledTimes(1)
    expect(stop).toHaveBeenCalledTimes(1)
  })

  it('surfaces truncated command output when setup fails', async () => {
    const stop = vi.fn().mockResolvedValue(undefined)
    const stderr = 'e'.repeat(4500)
    const stdout = 'o'.repeat(1200)

    mockGetWritable.mockImplementation(() => {
      throw new Error('best effort')
    })
    mockSandboxCreate.mockResolvedValue({
      runCommand: vi.fn().mockResolvedValue({
        exitCode: 7,
        stderr: vi.fn().mockResolvedValue(stderr),
        stdout: vi.fn().mockResolvedValue(stdout),
      }),
      snapshot: vi.fn(),
      stop,
    })

    try {
      await runSandboxBuild({
        buildId: 'build_123',
        manifestId: 'manifest_123',
        setup: 'exit 7',
      })
      throw new Error('Expected runSandboxBuild to throw')
    } catch (error) {
      expect(error).toBeInstanceOf(Error)
      const message = error instanceof Error ? error.message : String(error)

      expect(error).toMatchObject({ name: 'FatalError' })
      expect(message).toContain('setup script exited with code 7')
      expect(message).toContain('e'.repeat(4000))
      expect(message).not.toContain('e'.repeat(4001))
      expect(message).toContain('o'.repeat(1000))
      expect(message).not.toContain('o'.repeat(1001))
    }
    expect(stop).toHaveBeenCalledTimes(1)
  })
})
