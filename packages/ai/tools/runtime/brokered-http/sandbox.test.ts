import type { getConnector } from '@outname/shared/connections/registry'
import { beforeEach, expect, test, vi } from 'vitest'

const {
  mockReadConnectorCredential,
  mockSandboxCreate,
  mockWithVercelSandboxCredentials,
} = vi.hoisted(() => ({
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

import { createBrokerSandbox } from './sandbox'

beforeEach(() => {
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
