import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockGetAgentEvent,
  mockMarkEventHeartbeat,
  mockMarkEventRunning,
  mockMarkEventTerminal,
  mockRefreshAgentFileCache,
  mockSandboxDelete,
  mockSandboxGet,
  mockSandboxList,
  mockStopAllBrokeredHttpSandboxesForRun,
  mockStopAllRepoWorkspacesForRun,
  mockStopAllToolSandboxesForRun,
  mockWithVercelSandboxCredentials,
} = vi.hoisted(() => ({
  mockGetAgentEvent: vi.fn(),
  mockMarkEventHeartbeat: vi.fn(),
  mockMarkEventRunning: vi.fn(),
  mockMarkEventTerminal: vi.fn(),
  mockRefreshAgentFileCache: vi.fn(),
  mockSandboxDelete: vi.fn(),
  mockSandboxGet: vi.fn(),
  mockSandboxList: vi.fn(),
  mockStopAllBrokeredHttpSandboxesForRun: vi.fn(),
  mockStopAllRepoWorkspacesForRun: vi.fn(),
  mockStopAllToolSandboxesForRun: vi.fn(),
  mockWithVercelSandboxCredentials: vi.fn((options: unknown) => options),
}))

vi.mock('server-only', () => ({}))

vi.mock('@outname/ai/agent-runtime/server/agent-event-store', () => ({
  getAgentEvent: mockGetAgentEvent,
  markEventHeartbeat: mockMarkEventHeartbeat,
  markEventRunning: mockMarkEventRunning,
  markEventTerminal: mockMarkEventTerminal,
}))

vi.mock('@outname/ai/agent-runtime/server/file-cache', () => ({
  refreshAgentFileCache: mockRefreshAgentFileCache,
}))

vi.mock('@outname/ai/tools/runtime/brokered-http/sandbox', () => ({
  stopAllBrokeredHttpSandboxesForRun: mockStopAllBrokeredHttpSandboxesForRun,
}))

vi.mock('@outname/ai/tools/runtime/repo-workspace/sandbox', () => ({
  stopAllRepoWorkspacesForRun: mockStopAllRepoWorkspacesForRun,
}))

vi.mock('@outname/ai/tools/sandbox-runtime/runtime', () => ({
  stopAllToolSandboxesForRun: mockStopAllToolSandboxesForRun,
}))

vi.mock('@outname/shared/server/vercel-sandbox-config', () => ({
  withVercelSandboxCredentials: mockWithVercelSandboxCredentials,
}))

vi.mock('@vercel/sandbox', () => ({
  Sandbox: {
    get: mockSandboxGet,
    list: mockSandboxList,
  },
}))

import { cleanupEventResources } from './cleanup-event'
import {
  loadAgentEventStep,
  markAgentEventHeartbeatStep,
  markAgentEventRunningStep,
  markAgentEventTerminalStep,
} from './event-store'

describe('event step wrappers', () => {
  it('maps persisted events into workflow-safe payloads', async () => {
    mockGetAgentEvent.mockResolvedValue({
      agentId: 'agent_123',
      concurrencyKey: 'key_123',
      id: 'evt_123',
      payload: { foo: 'bar' },
      source: 'manual',
      status: 'running',
      type: 'heartbeat',
      workflowRunId: 'wrun_123',
    })

    await expect(loadAgentEventStep({ eventId: 'evt_123' })).resolves.toEqual({
      agentId: 'agent_123',
      concurrencyKey: 'key_123',
      id: 'evt_123',
      payload: { foo: 'bar' },
      source: 'manual',
      status: 'running',
      type: 'heartbeat',
      workflowRunId: 'wrun_123',
    })
  })

  it('returns null when the event no longer exists', async () => {
    mockGetAgentEvent.mockResolvedValue(null)

    await expect(loadAgentEventStep({ eventId: 'evt_missing' })).resolves.toBe(
      null
    )
  })

  it('delegates mutation helpers to the server store', async () => {
    await markAgentEventRunningStep({
      eventId: 'evt_123',
      workflowRunId: 'wrun_123',
    })
    await markAgentEventHeartbeatStep({ eventId: 'evt_123' })
    await markAgentEventTerminalStep({
      eventId: 'evt_123',
      lastError: 'boom',
      status: 'failed',
    })
    expect(mockMarkEventRunning).toHaveBeenCalledWith({
      eventId: 'evt_123',
      workflowRunId: 'wrun_123',
    })
    expect(mockMarkEventHeartbeat).toHaveBeenCalledWith('evt_123')
    expect(mockMarkEventTerminal).toHaveBeenCalledWith({
      eventId: 'evt_123',
      lastError: 'boom',
      status: 'failed',
    })
  })
})

describe('cleanupEventResources', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSandboxDelete.mockResolvedValue(undefined)
    mockSandboxGet.mockResolvedValue({ delete: mockSandboxDelete })
    mockSandboxList.mockResolvedValue({
      pagination: { next: undefined },
      sandboxes: [],
    })
    mockWithVercelSandboxCredentials.mockImplementation(
      (options: unknown) => options
    )
  })

  it('cleans up runtime resources and refreshes the file cache', async () => {
    mockRefreshAgentFileCache.mockResolvedValue(undefined)

    await cleanupEventResources({ agentId: 'agent_123', runId: 'wrun_123' })

    expect(mockStopAllToolSandboxesForRun).toHaveBeenCalledTimes(1)
    expect(mockStopAllBrokeredHttpSandboxesForRun).toHaveBeenCalledTimes(1)
    expect(mockStopAllRepoWorkspacesForRun).toHaveBeenCalledTimes(1)
    expect(mockSandboxList).toHaveBeenCalledWith({
      cursor: undefined,
      limit: 50,
    })
    expect(mockRefreshAgentFileCache).toHaveBeenCalledWith('agent_123')
  })

  it('deletes non-persistent sandboxes tagged with the workflow run id', async () => {
    mockRefreshAgentFileCache.mockResolvedValue(undefined)
    mockSandboxList.mockResolvedValue({
      pagination: { next: undefined },
      sandboxes: [
        {
          name: 'brokered-http-1',
          persistent: false,
          tags: { kind: 'brokered-http', runId: 'wrun_123' },
        },
        {
          name: 'repo-workspace-1',
          persistent: false,
          tags: { kind: 'repo-workspace', runId: 'wrun_123' },
        },
        {
          name: 'persistent-agent',
          persistent: true,
          tags: { kind: 'agent-system', runId: 'wrun_123' },
        },
        {
          name: 'other-run',
          persistent: false,
          tags: { kind: 'brokered-http', runId: 'wrun_other' },
        },
      ],
    })

    await cleanupEventResources({ agentId: 'agent_123', runId: 'wrun_123' })

    expect(mockSandboxGet).toHaveBeenCalledTimes(2)
    expect(mockSandboxGet).toHaveBeenCalledWith({
      name: 'brokered-http-1',
      resume: false,
    })
    expect(mockSandboxGet).toHaveBeenCalledWith({
      name: 'repo-workspace-1',
      resume: false,
    })
    expect(mockSandboxDelete).toHaveBeenCalledTimes(2)
  })

  it('logs file-cache refresh failures without rejecting the step', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    const refreshError = new Error('refresh failed')

    mockRefreshAgentFileCache.mockRejectedValue(refreshError)

    await expect(
      cleanupEventResources({ agentId: 'agent_123', runId: 'wrun_123' })
    ).resolves.toBeUndefined()

    expect(consoleError).toHaveBeenCalledWith(
      '[events] refreshAgentFileCache failed',
      refreshError
    )
  })
})
