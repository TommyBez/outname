import { randomUUID } from 'node:crypto'
import { auth } from '@outname/auth/server/auth'
import {
  createPkceVerifier,
  encodeOAuthState,
  normalizeConnectionReturnTo,
  OAUTH_STATE_TTL_SECONDS,
  oauthPkceCookieName,
  oauthRedirectUri,
  oauthScopeHash,
  pkceCookieOptions,
  pkceHash,
  signedPkceCookieValue,
} from '@outname/shared/connections/oauth-state'
import { readOAuthClientCredentials } from '@outname/shared/connections/oauth-token-client'
import {
  getConnector,
  validateConnectorRuntimeConfig,
} from '@outname/shared/connections/registry'
import { headers } from 'next/headers'
import { type NextRequest, NextResponse } from 'next/server'

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

  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL
  if (!baseUrl) {
    return redirectWithError(
      request,
      returnTo,
      'NEXT_PUBLIC_API_BASE_URL must be set to build the OAuth redirect URI.'
    )
  }

  const client = readOAuthClientCredentials(connector)
  if (!client.ok) {
    return redirectWithError(request, returnTo, client.error)
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
    scopeHash: oauthScopeHash(scopes),
    pkceHash: pkceHash(verifier),
  })
  const authorizeUrl = new URL(connector.oauth2.authorizationUrl)
  authorizeUrl.search = new URLSearchParams({
    response_type: 'code',
    client_id: client.credentials.clientId,
    redirect_uri: redirectUri,
    scope: scopes.join(' '),
    state,
    code_challenge: pkceHash(verifier),
    code_challenge_method: connector.oauth2.pkce.method,
  }).toString()

  const response = NextResponse.redirect(authorizeUrl)
  response.cookies.set({
    name: oauthPkceCookieName(connectorId),
    value: signedPkceCookieValue(verifier),
    ...pkceCookieOptions(OAUTH_STATE_TTL_SECONDS),
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
