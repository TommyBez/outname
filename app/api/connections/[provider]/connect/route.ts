import { randomBytes } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { getOAuthConnectorOrThrow } from '@/connectors/registry'
import type { OAuthConnector } from '@/connectors/types'
import { requireSession } from '@/lib/auth-guard'
import { db } from '@/lib/db'
import { agent } from '@/lib/db/schema'
import { safeReturnToOr } from '@/lib/safe-return-to'
import { unionScopesForAgent } from '@/tools/scopes-for-agent'

/**
 * Kick off an OAuth flow for the given provider.
 *
 * Query parameters:
 *   `agentId`   optional. When present, scopes are computed as the
 *               union of every scope required by the agent's
 *               currently-attached tools — never from the URL.
 *   `returnTo`  optional. Must validate as a same-origin path or it
 *               is dropped (open-redirect protection).
 *
 * State envelope is stored in a per-provider `__Host-conn-state-<provider>`
 * cookie carrying { state, agentId, returnTo }. The token sent to the
 * provider is JUST the 256-bit random `state`; the rest is recovered
 * from the cookie on callback so the URL stays small.
 */

function stateCookieName(provider: string): string {
  // `__Host-` prefix forces Secure + Path=/ + no Domain (guards against
  // sibling-subdomain cookie injection). Per-provider name so concurrent
  // flows on different connectors don't stomp each other.
  return `__Host-conn-state-${provider}`
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ provider: string }> }
) {
  const session = await requireSession()
  const { provider } = await params

  let connector: OAuthConnector
  try {
    connector = getOAuthConnectorOrThrow(provider)
  } catch {
    return NextResponse.json({ error: 'unknown_provider' }, { status: 404 })
  }

  const url = new URL(req.url)
  const agentIdRaw = url.searchParams.get('agentId')
  const returnTo = safeReturnToOr(url.searchParams.get('returnTo'), '/settings')

  // Verify agentId ownership before doing anything else. Without this
  // check, user A could cause user B's session-level connect attempt
  // to grant scopes derived from A's agent.
  let agentId: string | null = null
  if (agentIdRaw) {
    const [row] = await db
      .select({ id: agent.id })
      .from(agent)
      .where(and(eq(agent.id, agentIdRaw), eq(agent.userId, session.user.id)))
      .limit(1)
    if (!row) {
      return NextResponse.json({ error: 'agent_not_found' }, { status: 404 })
    }
    agentId = row.id
  }

  // Derive scopes server-side. NEVER read scopes from the URL.
  const scopes = agentId ? await unionScopesForAgent({ agentId, provider }) : []

  const state = randomBytes(32).toString('base64url')
  const redirectUri = new URL(
    `/api/connections/${provider}/callback`,
    url.origin
  ).toString()
  const authorizeUrl = connector.oauth.buildAuthorizeUrl({
    state,
    redirectUri,
    scopes,
  })

  const jar = await cookies()
  jar.set(
    stateCookieName(provider),
    JSON.stringify({ state, agentId, returnTo }),
    {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60, // 1h — generous for slow consent screens
    }
  )

  return NextResponse.redirect(authorizeUrl)
}
