import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import {
  decodeOAuthState,
  encodeOAuthState,
  normalizeConnectionReturnTo,
  OAUTH_STATE_TTL_SECONDS,
  oauthScopeHash,
  pkceCookieOptions,
  signedPkceCookieValue,
  unexpectedGrantedScopes,
  verifySignedPkceCookie,
} from './oauth-state'
import { X_OAUTH_SCOPES } from './x-oauth-scopes'

describe('OAuth state helpers', () => {
  beforeEach(() => {
    process.env.BETTER_AUTH_SECRET = 'test-oauth-secret'
  })

  afterEach(() => {
    vi.useRealTimers()
    delete process.env.BETTER_AUTH_SECRET
  })

  it('rejects tampered and expired state', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'))
    const state = encodeOAuthState({
      connectorId: 'x.oauth2_user',
      nonce: 'nonce_test',
      pkceHash: 'pkce_hash',
      returnTo: '/connections',
      scopeHash: oauthScopeHash(['tweet.read']),
      userId: 'user_test',
    })

    expect(decodeOAuthState(`${state}x`)).toBeNull()

    vi.setSystemTime(new Date('2026-01-01T00:11:00.000Z'))
    expect(decodeOAuthState(state)).toBeNull()
  })

  it('normalizes returnTo to same-origin paths only', () => {
    expect(normalizeConnectionReturnTo('/connections?x=1#done')).toBe(
      '/connections?x=1#done'
    )
    expect(normalizeConnectionReturnTo('https://evil.test')).toBe(
      '/connections'
    )
    expect(normalizeConnectionReturnTo('//evil.test')).toBe('/connections')
    expect(normalizeConnectionReturnTo('/\\evil')).toBe('/connections')
    expect(normalizeConnectionReturnTo(null)).toBe('/connections')
  })

  it('rejects tampered PKCE cookie values', () => {
    const cookie = signedPkceCookieValue('verifier_test')

    expect(verifySignedPkceCookie(cookie)).toBe('verifier_test')
    expect(verifySignedPkceCookie(`${cookie}x`)).toBeNull()
  })

  it('keeps PKCE cookie attributes aligned with the OAuth state TTL', () => {
    expect(pkceCookieOptions(OAUTH_STATE_TTL_SECONDS)).toMatchObject({
      httpOnly: true,
      maxAge: 600,
      path: '/api/connections/oauth/',
      sameSite: 'lax',
    })
  })

  it('keeps the signed state under the X OAuth limit with the full scope bundle', () => {
    const state = encodeOAuthState({
      connectorId: 'x.oauth2_user',
      nonce: 'nonce_test',
      pkceHash: 'pkce_hash',
      returnTo: '/connections',
      scopeHash: oauthScopeHash(X_OAUTH_SCOPES),
      userId: 'user_123456789012345678901234567890',
    })

    expect(state.length).toBeLessThanOrEqual(500)
  })

  it('detects provider-granted scopes outside the signed request', () => {
    expect(
      unexpectedGrantedScopes(
        ['tweet.read', 'users.read', 'dm.read'],
        ['tweet.read', 'users.read']
      )
    ).toEqual(['dm.read'])
  })
})
