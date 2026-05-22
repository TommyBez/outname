import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  refreshAgentFileCache: vi.fn(),
  stopAllBrokeredHttpSandboxesForRun: vi.fn(),
  stopAllRepoWorkspacesForRun: vi.fn(),
  stopAllToolSandboxesForRun: vi.fn(),
}))

vi.mock('server-only', () => ({}))

vi.mock('@/agent-runtime/server/file-cache', () => ({
  refreshAgentFileCache: mocks.refreshAgentFileCache,
}))

vi.mock('@/tools/runtime/brokered-http/sandbox', () => ({
  stopAllBrokeredHttpSandboxesForRun: mocks.stopAllBrokeredHttpSandboxesForRun,
}))

vi.mock('@/tools/runtime/repo-workspace/sandbox', () => ({
  stopAllRepoWorkspacesForRun: mocks.stopAllRepoWorkspacesForRun,
}))

vi.mock('@/tools/sandbox-runtime/runtime', () => ({
  stopAllToolSandboxesForRun: mocks.stopAllToolSandboxesForRun,
}))

describe('cleanupRealtimeRun', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.refreshAgentFileCache.mockResolvedValue([])
    mocks.stopAllBrokeredHttpSandboxesForRun.mockResolvedValue(undefined)
    mocks.stopAllRepoWorkspacesForRun.mockResolvedValue(undefined)
    mocks.stopAllToolSandboxesForRun.mockResolvedValue(undefined)
  })

  it('downgrades missing system sandbox refresh failures to a warning', async () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    const consoleWarnSpy = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined)
    mocks.refreshAgentFileCache.mockRejectedValue({
      json: { error: { code: 'not_found' } },
      response: { status: 404 },
      sandboxName: 'agent-ag_123-system',
    })

    try {
      const { cleanupRealtimeRun } = await import('./realtime-cleanup')
      await cleanupRealtimeRun({ agentId: 'ag_123' })

      expect(consoleErrorSpy).not.toHaveBeenCalled()
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[realtime-cleanup] refreshAgentFileCache skipped; system sandbox is missing',
        {
          agentId: 'ag_123',
          sandboxName: 'agent-ag_123-system',
        }
      )
    } finally {
      consoleErrorSpy.mockRestore()
      consoleWarnSpy.mockRestore()
    }
  })

  it('keeps logging non-missing-sandbox cleanup failures as errors', async () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    const consoleWarnSpy = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined)
    const failure = new Error('redis failed')
    mocks.refreshAgentFileCache.mockRejectedValue(failure)

    try {
      const { cleanupRealtimeRun } = await import('./realtime-cleanup')
      await cleanupRealtimeRun({ agentId: 'ag_123' })

      expect(consoleWarnSpy).not.toHaveBeenCalled()
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[realtime-cleanup] refreshAgentFileCache failed',
        failure
      )
    } finally {
      consoleErrorSpy.mockRestore()
      consoleWarnSpy.mockRestore()
    }
  })
})
