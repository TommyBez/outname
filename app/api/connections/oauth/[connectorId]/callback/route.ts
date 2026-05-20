import { Buffer } from 'node:buffer'
import { revalidatePath, updateTag } from 'next/cache'
import { headers } from 'next/headers'
import { type NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth/server/auth'
import {
  decodeOAuthState,
  oauthPkceCookieName,
  oauthRedirectUri,
  pkceHash,
  unexpectedGrantedScopes,
  verifySignedPkceCookie,
} from '@/connections/oauth-state'
import { getConnector } from '@/connections/registry'
import { persistOAuth2Connection } from '@/connections/runtime/store'
import type { StoredOAuth2CredentialBlob } from '@/connections/types'
import { userConnectionsTag } from '@/shared/server/cache-tags'

const SCOPE_SPLIT_PATTERN = /\s+/

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ connectorId: string }> }
): Promise<Response> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { connectorId } = await params
  const connector = getConnector(connectorId)
  const stateParam = request.nextUrl.searchParams.get('state')
  const decoded = stateParam ? decodeOAuthState(stateParam) : null
  const returnTo = decoded?.returnTo ?? '/connections'

  const error = request.nextUrl.searchParams.get('error')
  if (error) {
    return redirectWithCookieClear(request, connectorId, returnTo, {
      connection: 'error',
      reason: `oauth: ${error}`,
    })
  }
  if (!connector || connector.authKind !== 'oauth2') {
    return redirectWithCookieClear(request, connectorId, returnTo, {
      connection: 'error',
      reason: 'Unknown OAuth connector.',
    })
  }
  if (!decoded) {
    return redirectWithCookieClear(request, connectorId, returnTo, {
      connection: 'error',
      reason: 'invalid state',
    })
  }
  if (
    decoded.userId !== session.user.id ||
    decoded.connectorId !== connectorId
  ) {
    return redirectWithCookieClear(request, connectorId, returnTo, {
      connection: 'error',
      reason: 'state does not match session user or connector',
    })
  }

  const verifier = verifySignedPkceCookie(
    request.cookies.get(oauthPkceCookieName(connectorId))?.value
  )
  if (!verifier || pkceHash(verifier) !== decoded.pkceHash) {
    return redirectWithCookieClear(request, connectorId, returnTo, {
      connection: 'error',
      reason: 'invalid PKCE verifier',
    })
  }

  const code = request.nextUrl.searchParams.get('code')
  if (!code) {
    return redirectWithCookieClear(request, connectorId, returnTo, {
      connection: 'error',
      reason: 'missing code',
    })
  }

  const baseUrl = process.env.BETTER_AUTH_URL
  if (!baseUrl) {
    return redirectWithCookieClear(request, connectorId, returnTo, {
      connection: 'error',
      reason: 'BETTER_AUTH_URL must be set',
    })
  }

  try {
    const token = await exchangeCode({
      code,
      connector,
      redirectUri: oauthRedirectUri(baseUrl, connectorId),
      verifier,
    })
    const unexpectedScopes = unexpectedGrantedScopes(
      token.grantedScopes,
      decoded.scopes
    )
    if (unexpectedScopes.length > 0) {
      throw new Error(
        `OAuth provider granted unexpected scope${unexpectedScopes.length === 1 ? '' : 's'}: ${unexpectedScopes.join(', ')}`
      )
    }
    const metadata = await readProfileMetadata(connector, token.accessToken)
    await persistOAuth2Connection({
      userId: session.user.id,
      connectorId,
      credentials: token.credentials,
      expiresAt: token.expiresAt,
      grantedScopes: token.grantedScopes,
      metadata,
    })
    updateConnectionSurfaces(session.user.id)
    return redirectWithCookieClear(request, connectorId, returnTo, {
      connection: 'connected',
    })
  } catch (err) {
    return redirectWithCookieClear(request, connectorId, returnTo, {
      connection: 'error',
      reason: err instanceof Error ? err.message : 'oauth failed',
    })
  }
}

async function exchangeCode(input: {
  code: string
  connector: Extract<ReturnType<typeof getConnector>, { authKind: 'oauth2' }>
  redirectUri: string
  verifier: string
}): Promise<{
  accessToken: string
  credentials: StoredOAuth2CredentialBlob
  expiresAt: Date | null
  grantedScopes: string[]
}> {
  const clientId = process.env[input.connector.oauth2.clientIdEnv]
  const clientSecret = input.connector.oauth2.clientSecretEnv
    ? process.env[input.connector.oauth2.clientSecretEnv]
    : undefined
  if (!clientId) {
    throw new Error(`${input.connector.oauth2.clientIdEnv} is not configured.`)
  }

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: input.code,
    redirect_uri: input.redirectUri,
    code_verifier: input.verifier,
    client_id: clientId,
  })
  const headers: Record<string, string> = {
    accept: 'application/json',
    'content-type': 'application/x-www-form-urlencoded',
  }
  if (clientSecret) {
    headers.authorization = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`
  }

  const response = await fetch(input.connector.oauth2.tokenUrl, {
    body,
    headers,
    method: 'POST',
  })
  const payload = (await response.json().catch(() => ({}))) as {
    access_token?: unknown
    error?: unknown
    error_description?: unknown
    expires_in?: unknown
    refresh_token?: unknown
    scope?: unknown
    token_type?: unknown
  }
  if (!response.ok) {
    throw new Error(providerOAuthError(payload, response.status))
  }
  if (
    typeof payload.access_token !== 'string' ||
    (payload.token_type !== undefined && payload.token_type !== 'Bearer')
  ) {
    throw new Error('OAuth provider returned an invalid token response.')
  }
  const credentials: StoredOAuth2CredentialBlob = {
    kind: 'oauth2',
    version: 1,
    tokenType: 'Bearer',
    accessToken: payload.access_token,
    refreshToken:
      typeof payload.refresh_token === 'string'
        ? payload.refresh_token
        : undefined,
  }
  return {
    accessToken: payload.access_token,
    credentials,
    expiresAt:
      typeof payload.expires_in === 'number'
        ? new Date(Date.now() + payload.expires_in * 1000)
        : null,
    grantedScopes:
      typeof payload.scope === 'string'
        ? payload.scope.split(SCOPE_SPLIT_PATTERN).filter(Boolean)
        : [...input.connector.oauth2.defaultScopes],
  }
}

async function readProfileMetadata(
  connector: Extract<ReturnType<typeof getConnector>, { authKind: 'oauth2' }>,
  accessToken: string
): Promise<Record<string, unknown>> {
  if (!connector.oauth2.profile) {
    return {}
  }
  try {
    return await connector.oauth2.profile(accessToken)
  } catch {
    return {}
  }
}

function providerOAuthError(
  payload: { error?: unknown; error_description?: unknown },
  status: number
): string {
  const error = typeof payload.error === 'string' ? payload.error : null
  const description =
    typeof payload.error_description === 'string'
      ? payload.error_description
      : null
  return [error, description].filter(Boolean).join(': ') || `HTTP ${status}`
}

function redirectWithCookieClear(
  request: NextRequest,
  connectorId: string,
  returnTo: string,
  params: Record<string, string>
): Response {
  const target = new URL(returnTo, request.url)
  for (const [key, value] of Object.entries(params)) {
    target.searchParams.set(key, value)
  }
  const response = NextResponse.redirect(target)
  response.cookies.set({
    name: oauthPkceCookieName(connectorId),
    value: '',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/api/connections/oauth/',
    maxAge: 0,
  })
  return response
}

function updateConnectionSurfaces(userId: string): void {
  updateTag(userConnectionsTag(userId))
  revalidatePath('/connections')
}
