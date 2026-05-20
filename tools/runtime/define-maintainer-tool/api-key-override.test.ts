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
  readCredentialOverride,
  redactCredentialOverrides,
  stripCredentialOverrides,
  withEncryptedCredentialOverrides,
} from './api-key-override'

beforeEach(() => {
  mockDecryptCredential.mockReset()
  mockEncryptCredential.mockReset()
})

test('encrypts provider-shaped credential overrides before storing them in config', async () => {
  mockEncryptCredential.mockResolvedValue('encrypted-token')

  await expect(
    withEncryptedCredentialOverrides({
      allowedProviders: new Set(['x']),
      config: { readOnly: true },
      source: {
        credentialOverrides: {
          x: { bearerToken: '  Bearer live-token  ' },
        },
      },
    })
  ).resolves.toEqual({
    ok: true,
    config: {
      _secrets: {
        credentialOverrides: {
          x: {
            encrypted: 'encrypted-token',
            version: 1,
          },
        },
      },
      readOnly: true,
    },
  })
  expect(mockEncryptCredential).toHaveBeenCalledWith({
    bearerToken: 'live-token',
  })
})

test('encrypts standard apiKey provider overrides', async () => {
  mockEncryptCredential.mockResolvedValue('encrypted-api-key')

  await expect(
    withEncryptedCredentialOverrides({
      allowedProviders: new Set(['v0']),
      config: {},
      source: {
        credentialOverrides: {
          v0: { apiKey: 'v0_live-token' },
        },
      },
    })
  ).resolves.toEqual({
    ok: true,
    config: {
      _secrets: {
        credentialOverrides: {
          v0: {
            encrypted: 'encrypted-api-key',
            version: 1,
          },
        },
      },
    },
  })
  expect(mockEncryptCredential).toHaveBeenCalledWith({
    apiKey: 'v0_live-token',
  })
})

test('preserves existing encrypted provider overrides when no replacement is provided', async () => {
  const existingConfig = {
    _secrets: {
      credentialOverrides: {
        x: {
          encrypted: 'existing-token',
          version: 1,
        },
      },
    },
  }

  await expect(
    withEncryptedCredentialOverrides({
      allowedProviders: new Set(['x']),
      config: { readOnly: false },
      source: {},
      fallbackSource: existingConfig,
    })
  ).resolves.toEqual({
    ok: true,
    config: {
      _secrets: {
        credentialOverrides: {
          x: {
            encrypted: 'existing-token',
            version: 1,
          },
        },
      },
      readOnly: false,
    },
  })
  expect(mockEncryptCredential).not.toHaveBeenCalled()
})

test('empty submitted override fields preserve the existing encrypted override', async () => {
  const existingConfig = {
    _secrets: {
      credentialOverrides: {
        x: {
          encrypted: 'existing-token',
          version: 1,
        },
      },
    },
  }

  await expect(
    withEncryptedCredentialOverrides({
      allowedProviders: new Set(['x']),
      config: { readOnly: false },
      source: {
        credentialOverrides: {
          x: { bearerToken: '   ' },
        },
      },
      fallbackSource: existingConfig,
    })
  ).resolves.toEqual({
    ok: true,
    config: {
      _secrets: {
        credentialOverrides: {
          x: {
            encrypted: 'existing-token',
            version: 1,
          },
        },
      },
      readOnly: false,
    },
  })
  expect(mockEncryptCredential).not.toHaveBeenCalled()
})

test('removes requested provider overrides while preserving the rest', async () => {
  const existingConfig = {
    _secrets: {
      credentialOverrides: {
        github: {
          encrypted: 'existing-github-token',
          version: 1,
        },
        x: {
          encrypted: 'existing-x-token',
          version: 1,
        },
      },
    },
  }

  await expect(
    withEncryptedCredentialOverrides({
      allowedProviders: new Set(['github', 'x']),
      config: { readOnly: true },
      source: {
        credentialOverrideRemovals: ['x'],
      },
      fallbackSource: existingConfig,
    })
  ).resolves.toEqual({
    ok: true,
    config: {
      _secrets: {
        credentialOverrides: {
          github: {
            encrypted: 'existing-github-token',
            version: 1,
          },
        },
      },
      readOnly: true,
    },
  })
  expect(mockEncryptCredential).not.toHaveBeenCalled()
})

test('rejects partial multi-field credential overrides', async () => {
  await expect(
    withEncryptedCredentialOverrides({
      allowedProviders: new Set(['posthog']),
      config: {},
      source: {
        credentialOverrides: {
          posthog: { apiKey: 'phx_test' },
        },
      },
    })
  ).resolves.toMatchObject({
    ok: false,
  })
  expect(mockEncryptCredential).not.toHaveBeenCalled()
})

test('redacts raw, encrypted, and legacy override values for client-facing config', () => {
  const config = {
    _secrets: {
      credentialOverrides: {
        x: {
          encrypted: 'encrypted-token',
          version: 1,
        },
      },
    },
    apiKeyOverride: 'legacy-plain-token',
    credentialOverrides: {
      x: { bearerToken: 'plain-token' },
    },
    credentialOverrideRemovals: ['x'],
    readOnly: true,
  }

  expect(redactCredentialOverrides(config)).toEqual({ readOnly: true })
  expect(stripCredentialOverrides(config)).toEqual({ readOnly: true })
})

test('decrypts stored provider overrides for runtime use', async () => {
  mockDecryptCredential.mockResolvedValue({ token: 'ghp_test-token' })

  await expect(
    readCredentialOverride({
      config: {
        _secrets: {
          credentialOverrides: {
            github: {
              encrypted: 'encrypted-token',
              version: 1,
            },
          },
        },
      },
      provider: 'github',
    })
  ).resolves.toEqual({ token: 'ghp_test-token' })
  expect(mockDecryptCredential).toHaveBeenCalledWith('encrypted-token')
})
