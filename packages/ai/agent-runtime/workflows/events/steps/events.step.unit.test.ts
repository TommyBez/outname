import { describe, expect, it, vi } from 'vitest'

const {
  mockGetAgentEvent,
  mockMarkEventHeartbeat,
  mockMarkEventRunning,
  mockMarkEventTerminal,
  mockRefreshAgentFileCache,
  mockSetEventPublisherWorkflowRunId,
  mockStopAllBrokeredHttpSandboxesForRun,
  mockStopAllRepoWorkspacesForRun,
  mockStopAllToolSandboxesForRun,
} = vi.hoisted(() => ({
  mockGetAgentEvent: vi.fn(),
  mockMarkEventHeartbeat: vi.fn(),
  mockMarkEventRunning: vi.fn(),
  mockMarkEventTerminal: vi.fn(),
  mockRefreshAgentFileCache: vi.fn(),
  mockSetEventPublisherWorkflowRunId: vi.fn(),
  mockStopAllBrokeredHttpSandboxesForRun: vi.fn(),
  mockStopAllRepoWorkspacesForRun: vi.fn(),
  mockStopAllToolSandboxesForRun: vi.fn(),
}))

vi.mock('server-only', () => ({}))

vi.mock('@outname/ai/agent-runtime/server/agent-event-store', () => ({
  getAgentEvent: mockGetAgentEvent,
  markEventHeartbeat: mockMarkEventHeartbeat,
  markEventRunning: mockMarkEventRunning,
  markEventTerminal: mockMarkEventTerminal,
  setEventPublisherWorkflowRunId: mockSetEventPublisherWorkflowRunId,
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

import { cleanupEventResources } from './cleanup-event'
import {
  loadAgentEventStep,
  markAgentEventHeartbeatStep,
  markAgentEventRunningStep,
  markAgentEventTerminalStep,
  setAgentEventPublisherWorkflowRunIdStep,
} from './event-store'

describe('event step wrappers', () => {
  it('maps persisted events into workflow-safe payloads', async () => {
    mockGetAgentEvent.mockResolvedValue({
      agentId: 'agent_123',
      concurrencyKey: 'key_123',
      id: 'evt_123',
      payload: { foo: 'bar' },
      publisherWorkflowRunId: 'wrun_publisher',
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
      publisherWorkflowRunId: 'wrun_publisher',
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
    await setAgentEventPublisherWorkflowRunIdStep({
      eventId: 'evt_123',
      publisherWorkflowRunId: 'wrun_publisher',
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
    expect(mockSetEventPublisherWorkflowRunId).toHaveBeenCalledWith({
      eventId: 'evt_123',
      publisherWorkflowRunId: 'wrun_publisher',
    })
  })
})

describe('cleanupEventResources', () => {
  it('cleans up runtime resources and refreshes the file cache', async () => {
    mockRefreshAgentFileCache.mockResolvedValue(undefined)

    await cleanupEventResources({ agentId: 'agent_123' })

    expect(mockStopAllToolSandboxesForRun).toHaveBeenCalledTimes(1)
    expect(mockStopAllBrokeredHttpSandboxesForRun).toHaveBeenCalledTimes(1)
    expect(mockStopAllRepoWorkspacesForRun).toHaveBeenCalledTimes(1)
    expect(mockRefreshAgentFileCache).toHaveBeenCalledWith('agent_123')
  })

  it('logs file-cache refresh failures without rejecting the step', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    const refreshError = new Error('refresh failed')

    mockRefreshAgentFileCache.mockRejectedValue(refreshError)

    await expect(
      cleanupEventResources({ agentId: 'agent_123' })
    ).resolves.toBeUndefined()

    expect(consoleError).toHaveBeenCalledWith(
      '[events] refreshAgentFileCache failed',
      refreshError
    )
  })
})
