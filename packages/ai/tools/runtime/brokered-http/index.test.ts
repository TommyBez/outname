import { beforeEach, expect, test, vi } from 'vitest'

const {
  mockCreateBrokerSandbox,
  mockGetConnector,
  mockGetOrCreateBrokerSandbox,
  mockReadConnectorCredentialSnapshot,
  mockRunCommand,
} = vi.hoisted(() => ({
  mockCreateBrokerSandbox: vi.fn(),
  mockGetConnector: vi.fn(),
  mockGetOrCreateBrokerSandbox: vi.fn(),
  mockReadConnectorCredentialSnapshot: vi.fn(),
  mockRunCommand: vi.fn(),
}))

vi.mock('server-only', () => ({}))

vi.mock('@outname/shared/connections/registry', () => ({
  getConnector: mockGetConnector,
}))

vi.mock(
  '@outname/ai/tools/runtime/define-maintainer-tool/credential-resolver',
  () => ({
    readConnectorCredentialSnapshot: mockReadConnectorCredentialSnapshot,
  })
)

vi.mock('./sandbox', () => ({
  createBrokerSandbox: mockCreateBrokerSandbox,
  currentRunId: vi.fn(() => 'run_test'),
  getOrCreateBrokerSandbox: mockGetOrCreateBrokerSandbox,
}))

import { brokeredHttpRequest } from './index'

beforeEach(() => {
  mockCreateBrokerSandbox.mockReset()
  mockGetConnector.mockReset()
  mockGetOrCreateBrokerSandbox.mockReset()
  mockReadConnectorCredentialSnapshot.mockReset()
  mockRunCommand.mockReset()
})

test('brokered HTTP sandbox cache key includes the connector credential fingerprint', async () => {
  mockGetConnector.mockReturnValue({
    broker: {
      allowedHosts: ['api.x.com'],
      injectedHeaderNames: ['authorization'],
    },
  })
  mockReadConnectorCredentialSnapshot.mockResolvedValue({
    credential: { bearerToken: 'secret' },
    credentialSource: 'connection',
    tokenFingerprint: 'abc123ef',
  })
  mockRunCommand.mockResolvedValue({
    exitCode: 0,
    stderr: async () => '',
    stdout: async () =>
      JSON.stringify({
        bodyText: '{}',
        headers: {},
        ok: true,
        status: 200,
        truncated: false,
      }),
  })
  mockGetOrCreateBrokerSandbox.mockResolvedValue({
    runCommand: mockRunCommand,
  })

  await brokeredHttpRequest({
    agentId: 'agent_test',
    attachmentToolId: 'attachment_test',
    connectorId: 'x.bearer_token',
    request: {
      method: 'GET',
      url: 'https://api.x.com/2/users/me',
    },
    toolId: 'x_api_request',
    userId: 'user_test',
  })

  expect(mockGetOrCreateBrokerSandbox).toHaveBeenCalledWith(
    expect.objectContaining({
      connectorId: 'x.bearer_token:attachment_test:connection:abc123ef',
      runId: 'run_test',
    })
  )
})

test('brokered HTTP passes the same credential snapshot used for the sandbox key', async () => {
  const connector = {
    broker: {
      allowedHosts: ['api.x.com'],
      injectedHeaderNames: ['authorization'],
    },
  }
  const credential = { bearerToken: 'snapshot-secret' }
  mockGetConnector.mockReturnValue(connector)
  mockReadConnectorCredentialSnapshot.mockResolvedValue({
    credential,
    credentialSource: 'connection',
    tokenFingerprint: 'f00dbabe',
  })
  mockCreateBrokerSandbox.mockResolvedValue({
    runCommand: mockRunCommand,
  })
  mockGetOrCreateBrokerSandbox.mockImplementation(
    async (input) => await input.createSandbox()
  )
  mockRunCommand.mockResolvedValue({
    exitCode: 0,
    stderr: async () => '',
    stdout: async () =>
      JSON.stringify({
        bodyText: '{}',
        headers: {},
        ok: true,
        status: 200,
        truncated: false,
      }),
  })

  await brokeredHttpRequest({
    agentId: 'agent_test',
    attachmentToolId: 'attachment_test',
    connectorId: 'x.bearer_token',
    request: {
      method: 'GET',
      url: 'https://api.x.com/2/users/me',
    },
    toolId: 'x_api_request',
    userId: 'user_test',
  })

  expect(mockReadConnectorCredentialSnapshot).toHaveBeenCalledTimes(1)
  expect(mockCreateBrokerSandbox).toHaveBeenCalledWith(
    expect.objectContaining({
      connector,
      connectorId: 'x.bearer_token',
      credential,
    })
  )
})
