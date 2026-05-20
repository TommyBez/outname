import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { OAuth2Connector } from './types'

vi.mock('server-only', () => ({}))

import {
  buildOAuthClientAuthHeaders,
  exchangeAuthorizationCode,
  formatProviderOAuthError,
  isPermanentOAuthRefreshFailure,
  parseOAuth2TokenResponse,
  refreshAccessToken,
} from './oauth-token-client'

const connector = {
  authKind: 'oauth2',
  connectorId: 'x.oauth2_user',
  displayName: 'X API · OAuth User',
  oauth2: {
    clientIdEnv: 'TEST_OAUTH_CLIENT_ID',
    clientSecretEnv: 'TEST_OAUTH_CLIENT_SECRET',
    defaultScopes: ['tweet.read', 'users.read'],
    tokenUrl: 'https://provider.test/oauth/token',
  },
} as unknown as OAuth2Connector

describe('oauth-token-client', () => {
  beforeEach(() => {
    process.env.TEST_OAUTH_CLIENT_ID = 'client'
    process.env.TEST_OAUTH_CLIENT_SECRET = 'secret'
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    delete process.env.TEST_OAUTH_CLIENT_ID
    delete process.env.TEST_OAUTH_CLIENT_SECRET
  })

  it('normalizes token responses with refresh tokens, expiry, and space-separated scopes', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'))

    const result = parseOAuth2TokenResponse(
      {
        access_token: 'access-token',
        expires_in: 3600,
        refresh_token: 'refresh-token',
        scope: 'tweet.read  users.read',
        token_type: 'Bearer',
      },
      {
        fallbackScopes: ['fallback.scope'],
        invalidResponseMessage: 'invalid response',
      }
    )

    expect(result).toMatchObject({
      ok: true,
      token: {
        accessToken: 'access-token',
        credentials: {
          accessToken: 'access-token',
          kind: 'oauth2',
          refreshToken: 'refresh-token',
          tokenType: 'Bearer',
          version: 1,
        },
        grantedScopes: ['tweet.read', 'users.read'],
        refreshToken: 'refresh-token',
      },
    })
    expect(result.ok ? result.token.expiresAt : null).toEqual(
      new Date('2026-01-01T01:00:00.000Z')
    )
  })

  it('normalizes token responses without refresh tokens and falls back to caller scopes', () => {
    const result = parseOAuth2TokenResponse(
      {
        access_token: 'access-token',
        token_type: 'Bearer',
      },
      {
        fallbackScopes: ['tweet.read'],
        invalidResponseMessage: 'invalid response',
      }
    )

    expect(result).toMatchObject({
      ok: true,
      token: {
        accessToken: 'access-token',
        credentials: {
          accessToken: 'access-token',
          kind: 'oauth2',
          tokenType: 'Bearer',
          version: 1,
        },
        expiresAt: null,
        grantedScopes: ['tweet.read'],
        refreshToken: undefined,
      },
    })
  })

  it('rejects invalid token responses without an access token', () => {
    expect(
      parseOAuth2TokenResponse(
        { token_type: 'Bearer' },
        {
          fallbackScopes: [],
          invalidResponseMessage: 'invalid response',
        }
      )
    ).toEqual({ ok: false, error: 'invalid response' })
  })

  it('builds Basic auth headers when a client secret exists', () => {
    expect(buildOAuthClientAuthHeaders('client', 'secret')).toMatchObject({
      accept: 'application/json',
      authorization: 'Basic Y2xpZW50OnNlY3JldA==',
      'content-type': 'application/x-www-form-urlencoded',
    })
  })

  it('formats provider OAuth errors with provider details when available', () => {
    expect(
      formatProviderOAuthError(
        { error: 'invalid_grant', error_description: 'expired' },
        400
      )
    ).toBe('invalid_grant: expired')
    expect(formatProviderOAuthError({}, 503)).toBe('HTTP 503')
  })

  it.each([
    [400, 'invalid_grant', true],
    [400, 'invalid_request', true],
    [401, undefined, true],
    [429, 'rate_limited', false],
    [503, 'temporarily_unavailable', false],
  ])('classifies refresh failure %s/%s permanent=%s', (status, rawError, permanent) => {
    expect(isPermanentOAuthRefreshFailure(status, rawError)).toBe(permanent)
  })

  it('exchanges authorization codes with default scope fallback', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({
        access_token: 'access-token',
        token_type: 'Bearer',
      }),
      ok: true,
      status: 200,
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await exchangeAuthorizationCode(connector, {
      code: 'code',
      redirectUri: 'https://app.test/callback',
      verifier: 'verifier',
    })

    expect(result).toMatchObject({
      ok: true,
      accessToken: 'access-token',
      grantedScopes: ['tweet.read', 'users.read'],
    })
    expect(fetchMock).toHaveBeenCalledWith(
      'https://provider.test/oauth/token',
      expect.objectContaining({
        headers: expect.objectContaining({
          authorization: 'Basic Y2xpZW50OnNlY3JldA==',
        }),
        method: 'POST',
      })
    )
  })

  it.each([
    [400, { error: 'invalid_grant' }, true, 'invalid_grant'],
    [400, { error: 'invalid_request' }, true, 'invalid_request'],
    [429, { error: 'rate_limited' }, false, 'rate_limited'],
    [
      503,
      { error: 'temporarily_unavailable' },
      false,
      'temporarily_unavailable',
    ],
  ])('refreshes access tokens and classifies provider failures %s', async (status, payload, permanent, error) => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        json: async () => payload,
        ok: false,
        status,
      })
    )

    await expect(
      refreshAccessToken(connector, 'refresh-token')
    ).resolves.toEqual({
      ok: false,
      permanent,
      error,
    })
  })

  it('treats refresh network failures as transient', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))

    await expect(
      refreshAccessToken(connector, 'refresh-token')
    ).resolves.toEqual({
      ok: false,
      permanent: false,
      error: 'network down',
    })
  })
})
