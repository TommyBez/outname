import { beforeEach, expect, test, vi } from 'vitest'

const { mockReadConnectorCredential } = vi.hoisted(() => ({
  mockReadConnectorCredential: vi.fn(),
}))

vi.mock('server-only', () => ({}))

vi.mock('./credential-resolver', () => ({
  readConnectorCredential: mockReadConnectorCredential,
}))

import { readSdkCredentialResult } from './sdk-step'

beforeEach(() => {
  mockReadConnectorCredential.mockReset()
})

test('SDK credential reads include the attachment tool config override source', async () => {
  const toolConfig = {
    _secrets: {
      credentialOverrides: {
        'v0.api_key': {
          encrypted: 'encrypted-v0-token',
          version: 1,
        },
      },
    },
  }
  mockReadConnectorCredential.mockResolvedValue({ apiKey: 'v0_override-token' })

  await expect(
    readSdkCredentialResult({
      connectorId: 'v0.api_key',
      toolConfig,
      userId: 'user_test',
    })
  ).resolves.toEqual({
    ok: true,
    credential: { apiKey: 'v0_override-token' },
  })
  expect(mockReadConnectorCredential).toHaveBeenCalledWith({
    connectorId: 'v0.api_key',
    toolConfig,
    userId: 'user_test',
  })
})
