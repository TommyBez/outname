import type { getConnector } from '@outname/shared/connections/registry'
import { beforeEach, expect, test, vi } from 'vitest'

const {
  mockCurrentToolRuntimeRunId,
  mockReadConnectorCredential,
  mockSandboxCreate,
  mockWithVercelSandboxCredentials,
} = vi.hoisted(() => ({
  mockCurrentToolRuntimeRunId: vi.fn(),
  mockReadConnectorCredential: vi.fn(),
  mockSandboxCreate: vi.fn(),
  mockWithVercelSandboxCredentials: vi.fn((options) => ({
    ...options,
    projectId: 'prj_test',
    teamId: 'team_test',
    token: 'token_test',
  })),
}))

vi.mock('server-only', () => ({}))

vi.mock('@vercel/sandbox', () => ({
  Sandbox: {
    create: mockSandboxCreate,
  },
}))

vi.mock('@outname/ai/tools/runtime/run-id', () => ({
  currentToolRuntimeRunId: mockCurrentToolRuntimeRunId,
}))

vi.mock('@outname/shared/server/vercel-sandbox-config', () => ({
  brokeredHttpSandboxTags: vi.fn(() => ({ run: 'run_test' })),
  withVercelSandboxCredentials: mockWithVercelSandboxCredentials,
}))

vi.mock(
  '@outname/ai/tools/runtime/define-maintainer-tool/credential-resolver',
  () => ({
    readConnectorCredential: mockReadConnectorCredential,
  })
)

import {
  createBrokerSandbox,
  getOrCreateBrokerSandbox,
  stopAllBrokeredHttpSandboxesForRun,
} from './sandbox'

beforeEach(() => {
  mockCurrentToolRuntimeRunId.mockReturnValue('run_test')
  mockReadConnectorCredential.mockReset()
  mockSandboxCreate.mockReset()
  mockWithVercelSandboxCredentials.mockClear()
})

test('brokered HTTP header injection receives connector-shaped override credentials', async () => {
  const injectedHeaders = vi.fn((credential: { bearerToken: string }) => ({
    authorization: `Bearer ${credential.bearerToken}`,
  }))
  const connector = {
    broker: {
      allowedHosts: ['api.x.com'],
      injectedHeaderNames: ['authorization'],
      injectedHeaders,
    },
  } as unknown as NonNullable<ReturnType<typeof getConnector>>
  const toolConfig = {
    _secrets: {
      credentialOverrides: {
        'x.bearer_token': {
          encrypted: 'encrypted-token',
          version: 1,
        },
      },
    },
  }
  const sandbox = {}
  mockReadConnectorCredential.mockResolvedValue({
    bearerToken: 'override-token',
  })
  mockSandboxCreate.mockResolvedValue(sandbox)

  await expect(
    createBrokerSandbox({
      connector,
      connectorId: 'x.bearer_token',
      runId: 'run_test',
      toolConfig,
      userId: 'user_test',
    })
  ).resolves.toBe(sandbox)

  expect(mockReadConnectorCredential).toHaveBeenCalledWith({
    connectorId: 'x.bearer_token',
    toolConfig,
    userId: 'user_test',
  })
  expect(injectedHeaders).toHaveBeenCalledWith({
    bearerToken: 'override-token',
  })
  expect(mockSandboxCreate).toHaveBeenCalledWith(
    expect.objectContaining({
      networkPolicy: {
        allow: {
          'api.x.com': [
            {
              transform: [
                {
                  headers: {
                    authorization: 'Bearer override-token',
                  },
                },
              ],
            },
          ],
        },
      },
      projectId: 'prj_test',
      teamId: 'team_test',
      token: 'token_test',
    })
  )
})

test('broker sandbox cleanup deletes cached sandboxes and clears the cache', async () => {
  const runId = 'run_cleanup_success'
  const firstSandbox = { delete: vi.fn(async () => undefined) }
  const secondSandbox = { delete: vi.fn(async () => undefined) }
  const createSandbox = vi
    .fn()
    .mockResolvedValueOnce(firstSandbox)
    .mockResolvedValueOnce(secondSandbox)
  mockCurrentToolRuntimeRunId.mockReturnValue(runId)

  const firstResult = await getOrCreateBrokerSandbox({
    connectorId: 'x.bearer_token',
    createSandbox,
    runId,
  })
  const cachedResult = await getOrCreateBrokerSandbox({
    connectorId: 'x.bearer_token',
    createSandbox,
    runId,
  })

  expect(firstResult).toBe(firstSandbox)
  expect(cachedResult).toBe(firstSandbox)
  expect(createSandbox).toHaveBeenCalledTimes(1)

  await stopAllBrokeredHttpSandboxesForRun()

  expect(firstSandbox.delete).toHaveBeenCalledTimes(1)

  const nextResult = await getOrCreateBrokerSandbox({
    connectorId: 'x.bearer_token',
    createSandbox,
    runId,
  })

  expect(nextResult).toBe(secondSandbox)
  expect(createSandbox).toHaveBeenCalledTimes(2)
})

test('broker sandbox cleanup logs delete failures and still clears the cache', async () => {
  const runId = 'run_cleanup_failure'
  const deleteError = new Error('delete failed')
  const firstSandbox = { delete: vi.fn().mockRejectedValue(deleteError) }
  const secondSandbox = { delete: vi.fn(async () => undefined) }
  const createSandbox = vi
    .fn()
    .mockResolvedValueOnce(firstSandbox)
    .mockResolvedValueOnce(secondSandbox)
  const consoleErrorSpy = vi
    .spyOn(console, 'error')
    .mockImplementation(() => undefined)
  mockCurrentToolRuntimeRunId.mockReturnValue(runId)

  try {
    await getOrCreateBrokerSandbox({
      connectorId: 'x.bearer_token',
      createSandbox,
      runId,
    })

    await expect(stopAllBrokeredHttpSandboxesForRun()).resolves.toBeUndefined()

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'stopAllBrokeredHttpSandboxesForRun: delete failed',
      {
        connectorId: 'x.bearer_token',
        err: deleteError,
      }
    )

    const nextResult = await getOrCreateBrokerSandbox({
      connectorId: 'x.bearer_token',
      createSandbox,
      runId,
    })

    expect(nextResult).toBe(secondSandbox)
    expect(createSandbox).toHaveBeenCalledTimes(2)
  } finally {
    consoleErrorSpy.mockRestore()
  }
})

test('unauthenticated broker sandboxes skip credential lookup and injected headers', async () => {
  const injectedHeaders = vi.fn((credential: { bearerToken: string }) => ({
    authorization: `Bearer ${credential.bearerToken}`,
  }))
  const connector = {
    broker: {
      allowedHosts: ['api.x.com'],
      injectedHeaderNames: ['authorization'],
      injectedHeaders,
    },
  } as unknown as NonNullable<ReturnType<typeof getConnector>>
  const sandbox = {}
  mockSandboxCreate.mockResolvedValue(sandbox)

  await expect(
    createBrokerSandbox({
      connector,
      connectorId: 'x.bearer_token',
      runId: 'run_test',
      unauthenticatedHosts: ['cdn.x.com'],
      userId: 'user_test',
    })
  ).resolves.toBe(sandbox)

  expect(mockReadConnectorCredential).not.toHaveBeenCalled()
  expect(injectedHeaders).not.toHaveBeenCalled()
  expect(mockSandboxCreate).toHaveBeenCalledWith(
    expect.objectContaining({
      networkPolicy: {
        allow: {
          'cdn.x.com': [],
        },
      },
      projectId: 'prj_test',
      teamId: 'team_test',
      token: 'token_test',
    })
  )
})
