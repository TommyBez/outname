import { beforeEach, expect, test, vi } from 'vitest'

const { mockDecryptCredential, mockEncryptCredential } = vi.hoisted(() => ({
  mockDecryptCredential: vi.fn(),
  mockEncryptCredential: vi.fn(),
}))

vi.mock('server-only', () => ({}))

vi.mock('@/connections/crypto', () => ({
  decryptCredential: mockDecryptCredential,
  encryptCredential: mockEncryptCredential,
}))

import {
  readApiKeyOverride,
  redactApiKeyOverride,
  stripApiKeyOverride,
  withEncryptedApiKeyOverride,
} from './api-key-override'

beforeEach(() => {
  mockDecryptCredential.mockReset()
  mockEncryptCredential.mockReset()
})

test('encrypts raw apiKeyOverride before storing it in config', async () => {
  mockEncryptCredential.mockResolvedValue('encrypted-token')

  await expect(
    withEncryptedApiKeyOverride(
      { readOnly: true },
      { apiKeyOverride: '  live-token  ' }
    )
  ).resolves.toEqual({
    _secrets: {
      apiKeyOverride: {
        encrypted: 'encrypted-token',
        version: 1,
      },
    },
    readOnly: true,
  })
  expect(mockEncryptCredential).toHaveBeenCalledWith('live-token')
})

test('preserves existing encrypted override when no replacement is provided', async () => {
  const existingConfig = {
    _secrets: {
      apiKeyOverride: {
        encrypted: 'existing-token',
        version: 1,
      },
    },
  }

  await expect(
    withEncryptedApiKeyOverride({ readOnly: false }, {}, existingConfig)
  ).resolves.toEqual({
    _secrets: {
      apiKeyOverride: {
        encrypted: 'existing-token',
        version: 1,
      },
    },
    readOnly: false,
  })
  expect(mockEncryptCredential).not.toHaveBeenCalled()
})

test('redacts raw and encrypted override values for client-facing config', () => {
  const config = {
    _secrets: {
      apiKeyOverride: {
        encrypted: 'encrypted-token',
        version: 1,
      },
    },
    apiKeyOverride: 'plain-token',
    readOnly: true,
  }

  expect(redactApiKeyOverride(config)).toEqual({ readOnly: true })
  expect(stripApiKeyOverride(config)).toEqual({ readOnly: true })
})

test('decrypts stored override for runtime use', async () => {
  mockDecryptCredential.mockResolvedValue('live-token')

  await expect(
    readApiKeyOverride({
      _secrets: {
        apiKeyOverride: {
          encrypted: 'encrypted-token',
          version: 1,
        },
      },
    })
  ).resolves.toBe('live-token')
  expect(mockDecryptCredential).toHaveBeenCalledWith('encrypted-token')
})
