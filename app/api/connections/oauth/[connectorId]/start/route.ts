import { randomUUID } from 'node:crypto'
import { headers } from 'next/headers'
import { type NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth/server/auth'
import {
  codeChallenge,
  createPkceVerifier,
  encodeOAuthState,
  normalizeConnectionReturnTo,
  oauthPkceCookieName,
  oauthRedirectUri,
  pkceHash,
  signedPkceCookieValue,
} from '@/connections/oauth-state'
import {
  getConnector,
  validateConnectorRuntimeConfig,
} from '@/connections/registry'

const PKCE_COOKIE_MAX_AGE_SECONDS = 60 * 10

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ connectorId: string }> }
): Promise<Response> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const { connectorId } = await params
  const connector = getConnector(connectorId)
  const returnTo = normalizeConnectionReturnTo(
    request.nextUrl.searchParams.get('returnTo')
  )
  if (!connector || connector.authKind !== 'oauth2') {
    return redirectWithError(request, returnTo, 'Unknown OAuth connector.')
  }

  const config = validateConnectorRuntimeConfig(connectorId)
  if (!config.ok) {
    return redirectWithError(request, returnTo, config.error)
  }

  const baseUrl = process.env.BETTER_AUTH_URL
  if (!baseUrl) {
    return redirectWithError(
      request,
      returnTo,
      'BETTER_AUTH_URL must be set to build the OAuth redirect URI.'
    )
  }

  const clientId = process.env[connector.oauth2.clientIdEnv]
  if (!clientId) {
    return redirectWithError(
      request,
      returnTo,
      `${connector.oauth2.clientIdEnv} is not configured.`
    )
  }

  const verifier = createPkceVerifier()
  const nonce = randomUUID()
  const scopes = [...connector.oauth2.defaultScopes]
  const redirectUri = oauthRedirectUri(baseUrl, connectorId)
  const state = encodeOAuthState({
    userId: session.user.id,
    connectorId,
    returnTo,
    nonce,
    scopes,
    pkceHash: pkceHash(verifier),
  })
  const authorizeUrl = new URL(connector.oauth2.authorizationUrl)
  authorizeUrl.search = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: scopes.join(' '),
    state,
    code_challenge: codeChallenge(verifier),
    code_challenge_method: connector.oauth2.pkce.method,
  }).toString()

  const response = NextResponse.redirect(authorizeUrl)
  response.cookies.set({
    name: oauthPkceCookieName(connectorId),
    value: signedPkceCookieValue(verifier),
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/api/connections/oauth/',
    maxAge: PKCE_COOKIE_MAX_AGE_SECONDS,
  })
  return response
}

function redirectWithError(
  request: NextRequest,
  returnTo: string,
  reason: string
): Response {
  const target = new URL(returnTo, request.url)
  target.searchParams.set('connection', 'error')
  target.searchParams.set('reason', reason)
  return NextResponse.redirect(target)
}
