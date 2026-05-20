import { beforeEach, expect, test, vi } from 'vitest'

const { mockReadProviderCredential } = vi.hoisted(() => ({
  mockReadProviderCredential: vi.fn(),
}))

vi.mock('server-only', () => ({}))

vi.mock('./credential-resolver', () => ({
  readProviderCredential: mockReadProviderCredential,
}))

import { readSdkCredentialResult } from './sdk-step'

beforeEach(() => {
  mockReadProviderCredential.mockReset()
})

test('SDK credential reads include the attachment tool config override source', async () => {
  const toolConfig = {
    _secrets: {
      credentialOverrides: {
        v0: {
          encrypted: 'encrypted-v0-token',
          version: 1,
        },
      },
    },
  }
  mockReadProviderCredential.mockResolvedValue({ apiKey: 'v0_override-token' })

  await expect(
    readSdkCredentialResult({
      provider: 'v0',
      toolConfig,
      userId: 'user_test',
    })
  ).resolves.toEqual({
    ok: true,
    credential: { apiKey: 'v0_override-token' },
  })
  expect(mockReadProviderCredential).toHaveBeenCalledWith({
    provider: 'v0',
    toolConfig,
    userId: 'user_test',
  })
})
