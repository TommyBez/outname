import 'server-only'

import { Buffer } from 'node:buffer'
import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto'

const OAUTH_STATE_TTL_SECONDS = 60 * 10
const TRAILING_SLASH = /\/$/

export interface OAuthState {
  connectorId: string
  exp: number
  nonce: string
  pkceHash: string
  returnTo: string
  scopes: string[]
  userId: string
}

export function normalizeConnectionReturnTo(raw: string | null): string {
  if (!raw?.startsWith('/') || raw.startsWith('//')) {
    return '/connections'
  }
  if (raw.includes('\\')) {
    return '/connections'
  }
  return raw
}

export function encodeOAuthState(input: Omit<OAuthState, 'exp'>): string {
  const payload = {
    ...input,
    exp: Math.floor(Date.now() / 1000) + OAUTH_STATE_TTL_SECONDS,
  }
  const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString(
    'base64url'
  )
  const signature = sign(encodedPayload)
  return `${encodedPayload}.${signature}`
}

export function decodeOAuthState(raw: string): OAuthState | null {
  try {
    const [encodedPayload, signature] = raw.split('.')
    if (!(encodedPayload && signature)) {
      return null
    }
    const expected = sign(encodedPayload)
    const actualBuffer = Buffer.from(signature, 'utf8')
    const expectedBuffer = Buffer.from(expected, 'utf8')
    if (
      actualBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(actualBuffer, expectedBuffer)
    ) {
      return null
    }
    const payload = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString('utf8')
    ) as Partial<OAuthState>
    if (
      typeof payload.connectorId !== 'string' ||
      typeof payload.userId !== 'string' ||
      typeof payload.returnTo !== 'string' ||
      typeof payload.nonce !== 'string' ||
      typeof payload.pkceHash !== 'string' ||
      typeof payload.exp !== 'number' ||
      !Array.isArray(payload.scopes) ||
      !payload.scopes.every((scope) => typeof scope === 'string')
    ) {
      return null
    }
    if (Math.floor(Date.now() / 1000) > payload.exp) {
      return null
    }
    return {
      connectorId: payload.connectorId,
      userId: payload.userId,
      returnTo: normalizeConnectionReturnTo(payload.returnTo),
      nonce: payload.nonce,
      pkceHash: payload.pkceHash,
      scopes: payload.scopes,
      exp: payload.exp,
    }
  } catch {
    return null
  }
}

export function createPkceVerifier(): string {
  return randomBytes(32).toString('base64url')
}

export function pkceHash(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url')
}

export function codeChallenge(verifier: string): string {
  return pkceHash(verifier)
}

export function signedPkceCookieValue(verifier: string): string {
  return `${verifier}.${sign(verifier)}`
}

export function verifySignedPkceCookie(raw: string | undefined): string | null {
  if (!raw) {
    return null
  }
  const [verifier, signature] = raw.split('.')
  if (!(verifier && signature)) {
    return null
  }
  const expected = sign(verifier)
  const actualBuffer = Buffer.from(signature, 'utf8')
  const expectedBuffer = Buffer.from(expected, 'utf8')
  if (
    actualBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    return null
  }
  return verifier
}

export function oauthPkceCookieName(connectorId: string): string {
  return `oauth_pkce_${connectorId.replaceAll('.', '_')}`
}

export function oauthRedirectUri(baseUrl: string, connectorId: string): string {
  return `${baseUrl.replace(TRAILING_SLASH, '')}/api/connections/oauth/${encodeURIComponent(connectorId)}/callback`
}

export function unexpectedGrantedScopes(
  grantedScopes: readonly string[],
  requestedScopes: readonly string[]
): string[] {
  const requested = new Set(requestedScopes)
  return grantedScopes.filter((scope) => !requested.has(scope))
}

function sign(value: string): string {
  const secret = process.env.BETTER_AUTH_SECRET
  if (!secret) {
    throw new Error('BETTER_AUTH_SECRET must be set to sign OAuth state.')
  }
  return createHmac('sha256', secret).update(value).digest('base64url')
}
