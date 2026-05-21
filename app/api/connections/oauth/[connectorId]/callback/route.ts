import { revalidatePath, updateTag } from 'next/cache'
import { headers } from 'next/headers'
import { type NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth/server/auth'
import {
  decodeOAuthState,
  oauthPkceCookieName,
  oauthRedirectUri,
  oauthScopeHash,
  pkceCookieOptions,
  pkceHash,
  unexpectedGrantedScopes,
  verifySignedPkceCookie,
} from '@/connections/oauth-state'
import { exchangeAuthorizationCode } from '@/connections/oauth-token-client'
import { getConnector } from '@/connections/registry'
import { persistOAuth2Connection } from '@/connections/runtime/store'
import { userConnectionsTag } from '@/shared/server/cache-tags'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ connectorId: string }> }
): Promise<Response> {
  const { connectorId } = await params
  const stateParam = request.nextUrl.searchParams.get('state')
  const decoded = stateParam ? decodeOAuthState(stateParam) : null
  const returnTo = decoded?.returnTo ?? '/connections'
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return redirectWithCookieClear(request, connectorId, returnTo, {
      connection: 'error',
      reason: 'unauthorized',
    })
  }

  const connector = getConnector(connectorId)

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
    decoded.connectorId !== connectorId ||
    decoded.scopeHash !== oauthScopeHash(connector.oauth2.defaultScopes)
  ) {
    return redirectWithCookieClear(request, connectorId, returnTo, {
      connection: 'error',
      reason: 'state does not match session user, connector, or scopes',
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
    const token = await exchangeAuthorizationCode(connector, {
      code,
      redirectUri: oauthRedirectUri(baseUrl, connectorId),
      verifier,
    })
    if (!token.ok) {
      throw new Error(token.error)
    }
    const unexpectedScopes = unexpectedGrantedScopes(
      token.grantedScopes,
      connector.oauth2.defaultScopes
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
    ...pkceCookieOptions(0),
  })
  return response
}

function updateConnectionSurfaces(userId: string): void {
  updateTag(userConnectionsTag(userId))
  revalidatePath('/connections')
}
