import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

const TOKEN_FINGERPRINT_PATTERN = /^[a-f0-9]{16}$/

const {
  mockDbSelect,
  mockDecryptCredential,
  mockFetch,
  mockGetConnector,
  mockGetUpstashRedis,
  mockMarkInvalid,
  mockSleep,
  mockUpdateOAuth2ConnectionTokens,
} = vi.hoisted(() => ({
  mockDbSelect: vi.fn(),
  mockDecryptCredential: vi.fn(),
  mockFetch: vi.fn(),
  mockGetConnector: vi.fn(),
  mockGetUpstashRedis: vi.fn(),
  mockMarkInvalid: vi.fn(),
  mockSleep: vi.fn(),
  mockUpdateOAuth2ConnectionTokens: vi.fn(),
}))

vi.mock('server-only', () => ({}))

vi.mock('@/connections/crypto', () => ({
  decryptCredential: mockDecryptCredential,
}))

vi.mock('@/connections/registry', () => ({
  getConnector: mockGetConnector,
}))

vi.mock('@/shared/db', () => ({
  db: {
    select: mockDbSelect,
  },
}))

vi.mock('@/shared/server/upstash-redis', () => ({
  getUpstashRedis: mockGetUpstashRedis,
}))

vi.mock('node:timers/promises', () => ({
  setTimeout: mockSleep,
}))

vi.mock('./store', () => ({
  markInvalid: mockMarkInvalid,
  updateOAuth2ConnectionTokens: mockUpdateOAuth2ConnectionTokens,
}))

import { readConnectorCredential } from './credential'

const apiKeyConnector = {
  authKind: 'api_key',
  displayName: 'X API · App Bearer',
  apiKey: {
    formSchema: z.object({
      bearerToken: z.string(),
    }),
  },
}

const oauthConnector = {
  authKind: 'oauth2',
  connectorId: 'x.oauth2_user',
  displayName: 'X API · OAuth User',
  oauth2: {
    tokenUrl: 'https://api.x.com/2/oauth2/token',
    clientIdEnv: 'X_OAUTH_CLIENT_ID',
  },
}

interface MockConnectionRow {
  expiresAt: Date | null
  grantedScopes: string[]
  status: 'active' | 'invalid'
}

function mockConnectionRows(
  rows: Array<MockConnectionRow | null> = [
    {
      expiresAt: null,
      grantedScopes: [],
      status: 'active',
    },
  ]
): void {
  let index = 0
  mockDbSelect.mockImplementation(() => ({
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        limit: vi.fn(() => {
          const row = rows[Math.min(index, rows.length - 1)]
          index += 1
          if (!row) {
            return Promise.resolve([])
          }
          return Promise.resolve([
            {
              credentials: 'encrypted',
              expiresAt: row.expiresAt,
              grantedScopes: row.grantedScopes,
              status: row.status,
            },
          ])
        }),
      })),
    })),
  }))
}

function mockConnectionRow(
  row: MockConnectionRow = {
    expiresAt: null,
    grantedScopes: [],
    status: 'active',
  }
): void {
  mockConnectionRows([row])
}

function mockRedis() {
  return {
    del: vi.fn(async () => 1),
    get: vi.fn(async () => null),
    set: vi.fn(async (): Promise<'OK' | null> => 'OK'),
  }
}

describe('readConnectorCredential', () => {
  beforeEach(() => {
    process.env.X_OAUTH_CLIENT_ID = 'client_test'
    vi.stubGlobal('fetch', mockFetch)
    mockDbSelect.mockReset()
    mockDecryptCredential.mockReset()
    mockFetch.mockReset()
    mockGetConnector.mockReset()
    mockGetUpstashRedis.mockReset()
    mockMarkInvalid.mockReset()
    mockSleep.mockReset()
    mockUpdateOAuth2ConnectionTokens.mockReset()
    mockGetConnector.mockReturnValue(apiKeyConnector)
    mockGetUpstashRedis.mockReturnValue(null)
    mockSleep.mockResolvedValue(undefined)
    mockConnectionRow()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    delete process.env.X_OAUTH_CLIENT_ID
  })

  it('returns a stable API-key fingerprint that changes when the secret changes', async () => {
    mockDecryptCredential.mockResolvedValueOnce({
      kind: 'api_key',
      values: { bearerToken: 'first-secret' },
    })
    const first = await readConnectorCredential({
      connectorId: 'x.bearer_token',
      userId: 'user_test',
    })

    mockDecryptCredential.mockResolvedValueOnce({
      kind: 'api_key',
      values: { bearerToken: 'first-secret' },
    })
    const repeated = await readConnectorCredential({
      connectorId: 'x.bearer_token',
      userId: 'user_test',
    })

    mockDecryptCredential.mockResolvedValueOnce({
      kind: 'api_key',
      values: { bearerToken: 'second-secret' },
    })
    const changed = await readConnectorCredential({
      connectorId: 'x.bearer_token',
      userId: 'user_test',
    })

    expect(first.credential).toEqual({ bearerToken: 'first-secret' })
    expect(first.tokenFingerprint).toMatch(TOKEN_FINGERPRINT_PATTERN)
    expect(repeated.tokenFingerprint).toBe(first.tokenFingerprint)
    expect(changed.tokenFingerprint).not.toBe(first.tokenFingerprint)
    expect(first.tokenFingerprint).not.toBe('undefined')
  })

  it('fails OAuth refresh when Redis locking is unavailable', async () => {
    mockGetConnector.mockReturnValue(oauthConnector)
    mockConnectionRow({
      expiresAt: new Date(Date.now() - 1000),
      grantedScopes: ['tweet.read'],
      status: 'active',
    })
    mockDecryptCredential.mockResolvedValue({
      kind: 'oauth2',
      version: 1,
      accessToken: 'expired-access-token',
      refreshToken: 'refresh-token',
      tokenType: 'Bearer',
    })

    await expect(
      readConnectorCredential({
        connectorId: 'x.oauth2_user',
        userId: 'user_test',
      })
    ).rejects.toThrow('Redis is required for OAuth token refresh locking.')
  })

  it('refreshes an expired OAuth token under the Redis lock', async () => {
    const redis = mockRedis()
    mockGetConnector.mockReturnValue(oauthConnector)
    mockGetUpstashRedis.mockReturnValue(redis)
    mockConnectionRows([
      {
        expiresAt: new Date(Date.now() - 1000),
        grantedScopes: ['tweet.read'],
        status: 'active',
      },
      {
        expiresAt: new Date(Date.now() - 1000),
        grantedScopes: ['tweet.read'],
        status: 'active',
      },
    ])
    mockDecryptCredential.mockResolvedValue({
      kind: 'oauth2',
      version: 1,
      accessToken: 'expired-access-token',
      refreshToken: 'original-refresh-token',
      tokenType: 'Bearer',
    })
    mockFetch.mockResolvedValue({
      json: async () => ({
        access_token: 'fresh-access-token',
        expires_in: 7200,
        scope: 'tweet.read users.read',
        token_type: 'Bearer',
      }),
      ok: true,
      status: 200,
    })

    const result = await readConnectorCredential({
      connectorId: 'x.oauth2_user',
      userId: 'user_test',
    })

    expect(result.credential).toMatchObject({
      accessToken: 'fresh-access-token',
      refreshToken: 'original-refresh-token',
    })
    expect(result.tokenFingerprint).toMatch(TOKEN_FINGERPRINT_PATTERN)
    expect(redis.set).toHaveBeenCalledWith(
      'oauth-refresh:user_test:x.oauth2_user',
      expect.any(String),
      { ex: 10, nx: true }
    )
    expect(mockUpdateOAuth2ConnectionTokens).toHaveBeenCalledWith(
      expect.objectContaining({
        connectorId: 'x.oauth2_user',
        grantedScopes: ['tweet.read', 'users.read'],
        userId: 'user_test',
      })
    )
    expect(mockMarkInvalid).not.toHaveBeenCalled()
  })

  it('uses an unexpired OAuth token without a refresh token inside the pre-refresh window', async () => {
    mockGetConnector.mockReturnValue(oauthConnector)
    mockConnectionRow({
      expiresAt: new Date(Date.now() + 60_000),
      grantedScopes: ['tweet.read'],
      status: 'active',
    })
    mockDecryptCredential.mockResolvedValue({
      kind: 'oauth2',
      version: 1,
      accessToken: 'still-valid-access-token',
      tokenType: 'Bearer',
    })

    const result = await readConnectorCredential({
      connectorId: 'x.oauth2_user',
      userId: 'user_test',
    })

    expect(result.credential).toMatchObject({
      accessToken: 'still-valid-access-token',
    })
    expect(mockFetch).not.toHaveBeenCalled()
    expect(mockMarkInvalid).not.toHaveBeenCalled()
  })

  it('marks expired OAuth tokens without refresh tokens invalid', async () => {
    mockGetConnector.mockReturnValue(oauthConnector)
    mockConnectionRow({
      expiresAt: new Date(Date.now() - 1000),
      grantedScopes: ['tweet.read'],
      status: 'active',
    })
    mockDecryptCredential.mockResolvedValue({
      kind: 'oauth2',
      version: 1,
      accessToken: 'expired-access-token',
      tokenType: 'Bearer',
    })

    await expect(
      readConnectorCredential({
        connectorId: 'x.oauth2_user',
        userId: 'user_test',
      })
    ).rejects.toThrow(
      'X API · OAuth User token is expired and has no refresh token.'
    )

    expect(mockMarkInvalid).toHaveBeenCalledWith({
      connectorId: 'x.oauth2_user',
      error: 'X API · OAuth User token is expired and has no refresh token.',
      userId: 'user_test',
    })
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('marks malformed stored OAuth credentials invalid', async () => {
    mockGetConnector.mockReturnValue(oauthConnector)
    mockConnectionRow({
      expiresAt: null,
      grantedScopes: ['tweet.read'],
      status: 'active',
    })
    mockDecryptCredential.mockResolvedValue({
      kind: 'oauth2',
      version: 1,
      tokenType: 'Bearer',
    })

    await expect(
      readConnectorCredential({
        connectorId: 'x.oauth2_user',
        userId: 'user_test',
      })
    ).rejects.toThrow('Stored OAuth credential shape is invalid.')

    expect(mockMarkInvalid).toHaveBeenCalledWith({
      connectorId: 'x.oauth2_user',
      error: 'Stored OAuth credential shape is invalid.',
      userId: 'user_test',
    })
  })

  it('keeps a rotated refresh token returned by the OAuth provider', async () => {
    const redis = mockRedis()
    mockGetConnector.mockReturnValue(oauthConnector)
    mockGetUpstashRedis.mockReturnValue(redis)
    mockConnectionRows([
      {
        expiresAt: new Date(Date.now() - 1000),
        grantedScopes: ['tweet.read'],
        status: 'active',
      },
      {
        expiresAt: new Date(Date.now() - 1000),
        grantedScopes: ['tweet.read'],
        status: 'active',
      },
    ])
    mockDecryptCredential.mockResolvedValue({
      kind: 'oauth2',
      version: 1,
      accessToken: 'expired-access-token',
      refreshToken: 'original-refresh-token',
      tokenType: 'Bearer',
    })
    mockFetch.mockResolvedValue({
      json: async () => ({
        access_token: 'fresh-access-token',
        refresh_token: 'rotated-refresh-token',
        token_type: 'Bearer',
      }),
      ok: true,
      status: 200,
    })

    const result = await readConnectorCredential({
      connectorId: 'x.oauth2_user',
      userId: 'user_test',
    })

    expect(result.credential).toMatchObject({
      accessToken: 'fresh-access-token',
      refreshToken: 'rotated-refresh-token',
    })
    expect(mockUpdateOAuth2ConnectionTokens).toHaveBeenCalledWith(
      expect.objectContaining({
        credentials: expect.objectContaining({
          accessToken: 'fresh-access-token',
          refreshToken: 'rotated-refresh-token',
        }),
        grantedScopes: ['tweet.read'],
      })
    )
  })

  it('waits on a held refresh lock and reuses a freshly updated credential', async () => {
    const redis = mockRedis()
    redis.set.mockResolvedValueOnce(null)
    mockGetConnector.mockReturnValue(oauthConnector)
    mockGetUpstashRedis.mockReturnValue(redis)
    mockConnectionRows([
      {
        expiresAt: new Date(Date.now() - 1000),
        grantedScopes: ['tweet.read'],
        status: 'active',
      },
      {
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        grantedScopes: ['tweet.read'],
        status: 'active',
      },
    ])
    mockDecryptCredential
      .mockResolvedValueOnce({
        kind: 'oauth2',
        version: 1,
        accessToken: 'expired-access-token',
        refreshToken: 'refresh-token',
        tokenType: 'Bearer',
      })
      .mockResolvedValueOnce({
        kind: 'oauth2',
        version: 1,
        accessToken: 'fresh-access-token',
        refreshToken: 'refresh-token',
        tokenType: 'Bearer',
      })

    const result = await readConnectorCredential({
      connectorId: 'x.oauth2_user',
      userId: 'user_test',
    })

    expect(result.credential).toMatchObject({
      accessToken: 'fresh-access-token',
    })
    expect(redis.set).toHaveBeenCalledTimes(1)
    expect(mockSleep).toHaveBeenCalledTimes(1)
    expect(mockFetch).not.toHaveBeenCalled()
    expect(mockUpdateOAuth2ConnectionTokens).not.toHaveBeenCalled()
  })

  it('surfaces connection_unavailable when the lock holder marks the row invalid', async () => {
    const redis = mockRedis()
    redis.set.mockResolvedValueOnce(null)
    mockGetConnector.mockReturnValue(oauthConnector)
    mockGetUpstashRedis.mockReturnValue(redis)
    mockConnectionRows([
      {
        expiresAt: new Date(Date.now() - 1000),
        grantedScopes: ['tweet.read'],
        status: 'active',
      },
      {
        expiresAt: new Date(Date.now() - 1000),
        grantedScopes: ['tweet.read'],
        status: 'invalid',
      },
    ])
    mockDecryptCredential.mockResolvedValue({
      kind: 'oauth2',
      version: 1,
      accessToken: 'expired-access-token',
      refreshToken: 'refresh-token',
      tokenType: 'Bearer',
    })

    await expect(
      readConnectorCredential({
        connectorId: 'x.oauth2_user',
        userId: 'user_test',
      })
    ).rejects.toMatchObject({
      code: 'connection_unavailable',
      connectorId: 'x.oauth2_user',
    })

    expect(mockSleep).toHaveBeenCalledTimes(1)
    expect(mockFetch).not.toHaveBeenCalled()
    expect(mockUpdateOAuth2ConnectionTokens).not.toHaveBeenCalled()
  })

  it('retries the refresh after a stale lock expires', async () => {
    const redis = mockRedis()
    redis.set.mockResolvedValueOnce(null).mockResolvedValueOnce('OK')
    mockGetConnector.mockReturnValue(oauthConnector)
    mockGetUpstashRedis.mockReturnValue(redis)
    mockConnectionRows([
      {
        expiresAt: new Date(Date.now() - 1000),
        grantedScopes: ['tweet.read'],
        status: 'active',
      },
      {
        expiresAt: new Date(Date.now() - 1000),
        grantedScopes: ['tweet.read'],
        status: 'active',
      },
      {
        expiresAt: new Date(Date.now() - 1000),
        grantedScopes: ['tweet.read'],
        status: 'active',
      },
    ])
    mockDecryptCredential.mockResolvedValue({
      kind: 'oauth2',
      version: 1,
      accessToken: 'expired-access-token',
      refreshToken: 'refresh-token',
      tokenType: 'Bearer',
    })
    mockFetch.mockResolvedValue({
      json: async () => ({
        access_token: 'fresh-access-token',
        token_type: 'Bearer',
      }),
      ok: true,
      status: 200,
    })

    const result = await readConnectorCredential({
      connectorId: 'x.oauth2_user',
      userId: 'user_test',
    })

    expect(result.credential).toMatchObject({
      accessToken: 'fresh-access-token',
    })
    expect(redis.set).toHaveBeenCalledTimes(2)
    expect(mockSleep).toHaveBeenCalledTimes(1)
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(mockUpdateOAuth2ConnectionTokens).toHaveBeenCalled()
  })

  it('marks the connection invalid for invalid_grant refresh failures', async () => {
    const redis = mockRedis()
    mockGetConnector.mockReturnValue(oauthConnector)
    mockGetUpstashRedis.mockReturnValue(redis)
    mockConnectionRows([
      {
        expiresAt: new Date(Date.now() - 1000),
        grantedScopes: ['tweet.read'],
        status: 'active',
      },
      {
        expiresAt: new Date(Date.now() - 1000),
        grantedScopes: ['tweet.read'],
        status: 'active',
      },
    ])
    mockDecryptCredential.mockResolvedValue({
      kind: 'oauth2',
      version: 1,
      accessToken: 'expired-access-token',
      refreshToken: 'refresh-token',
      tokenType: 'Bearer',
    })
    mockFetch.mockResolvedValue({
      json: async () => ({
        error: 'invalid_grant',
        error_description: 'Refresh token expired',
      }),
      ok: false,
      status: 400,
    })

    await expect(
      readConnectorCredential({
        connectorId: 'x.oauth2_user',
        userId: 'user_test',
      })
    ).rejects.toThrow('invalid_grant: Refresh token expired')

    expect(mockMarkInvalid).toHaveBeenCalledWith({
      connectorId: 'x.oauth2_user',
      error: 'invalid_grant: Refresh token expired',
      userId: 'user_test',
    })
    expect(mockUpdateOAuth2ConnectionTokens).not.toHaveBeenCalled()
  })

  it('does not mutate connection state for transient refresh failures', async () => {
    const redis = mockRedis()
    mockGetConnector.mockReturnValue(oauthConnector)
    mockGetUpstashRedis.mockReturnValue(redis)
    mockConnectionRows([
      {
        expiresAt: new Date(Date.now() - 1000),
        grantedScopes: ['tweet.read'],
        status: 'active',
      },
      {
        expiresAt: new Date(Date.now() - 1000),
        grantedScopes: ['tweet.read'],
        status: 'active',
      },
    ])
    mockDecryptCredential.mockResolvedValue({
      kind: 'oauth2',
      version: 1,
      accessToken: 'expired-access-token',
      refreshToken: 'refresh-token',
      tokenType: 'Bearer',
    })
    mockFetch.mockResolvedValue({
      json: async () => ({ error: 'temporarily_unavailable' }),
      ok: false,
      status: 503,
    })

    await expect(
      readConnectorCredential({
        connectorId: 'x.oauth2_user',
        userId: 'user_test',
      })
    ).rejects.toThrow('temporarily_unavailable')

    expect(mockMarkInvalid).not.toHaveBeenCalled()
    expect(mockUpdateOAuth2ConnectionTokens).not.toHaveBeenCalled()
  })
})
