import { and, eq } from 'drizzle-orm'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { getOAuthConnectorOrThrow } from '@/connectors/registry'
import { persistOAuthExchange } from '@/connectors/runtime'
import type { OAuthConnector } from '@/connectors/types'
import { requireSession } from '@/lib/auth-guard'
import { db } from '@/lib/db'
import { agent } from '@/lib/db/schema'
import { safeReturnTo } from '@/lib/safe-return-to'

/**
 * OAuth callback — validates the state cookie, exchanges the code,
 * persists the credential, and redirects to the cookie-recorded
 * `returnTo` (or `/settings` if absent / unsafe).
 *
 * Anything that fails surfaces as `?conn=error&reason=...` on the
 * fallback page so the UI can flash a notice. We never throw a 500
 * out of this handler.
 */

function stateCookieName(provider: string): string {
  return `__Host-conn-state-${provider}`
}

interface StateCookie {
  agentId: string | null
  returnTo: string
  state: string
}

function parseStateCookie(value: string | undefined): StateCookie | null {
  if (!value) {
    return null
  }
  try {
    const parsed = JSON.parse(value) as Partial<StateCookie>
    if (typeof parsed.state !== 'string') {
      return null
    }
    return {
      state: parsed.state,
      agentId:
        typeof parsed.agentId === 'string' && parsed.agentId.length > 0
          ? parsed.agentId
          : null,
      returnTo:
        typeof parsed.returnTo === 'string' && parsed.returnTo.length > 0
          ? parsed.returnTo
          : '/settings',
    }
  } catch {
    return null
  }
}

function bail(origin: string, fallback: string, reason: string): NextResponse {
  const target = new URL(fallback, origin)
  target.searchParams.set('conn', 'error')
  target.searchParams.set('reason', reason)
  return NextResponse.redirect(target)
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ provider: string }> }
) {
  const session = await requireSession()
  const { provider } = await params
  const url = new URL(req.url)

  const jar = await cookies()
  const cookieValue = jar.get(stateCookieName(provider))?.value
  jar.delete(stateCookieName(provider))
  const cookieState = parseStateCookie(cookieValue)

  // Always validate the user-controlled returnTo (cookie source — we set
  // it ourselves on `/connect` after passing through `safeReturnTo`, but
  // re-validate on the way out as defense in depth).
  const returnTo =
    safeReturnTo(cookieState?.returnTo) ??
    safeReturnTo(url.searchParams.get('returnTo')) ??
    '/settings'

  const error = url.searchParams.get('error')
  if (error) {
    return bail(url.origin, returnTo, error)
  }

  let connector: OAuthConnector
  try {
    connector = getOAuthConnectorOrThrow(provider)
  } catch {
    return bail(url.origin, returnTo, 'unknown_provider')
  }

  if (!cookieState) {
    return bail(url.origin, returnTo, 'state_missing')
  }
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  if (!(code && state) || state !== cookieState.state) {
    return bail(url.origin, returnTo, 'state_mismatch')
  }

  // If the cookie says this flow was tied to an agent, verify
  // ownership again on the way back too. A stale cookie carrying
  // someone else's agentId would otherwise pin the new credential to
  // the wrong owner.
  if (cookieState.agentId) {
    const [row] = await db
      .select({ id: agent.id })
      .from(agent)
      .where(
        and(
          eq(agent.id, cookieState.agentId),
          eq(agent.userId, session.user.id)
        )
      )
      .limit(1)
    if (!row) {
      return bail(url.origin, returnTo, 'agent_ownership_mismatch')
    }
  }

  const redirectUri = new URL(
    `/api/connections/${provider}/callback`,
    url.origin
  ).toString()

  try {
    const result = await connector.oauth.exchangeCode({ code, redirectUri })
    await persistOAuthExchange({
      userId: session.user.id,
      provider,
      result,
    })
  } catch (err) {
    return bail(
      url.origin,
      returnTo,
      err instanceof Error ? err.message : 'exchange_failed'
    )
  }

  const target = new URL(returnTo, url.origin)
  target.searchParams.set('conn', 'connected')
  target.searchParams.set('provider', provider)
  return NextResponse.redirect(target)
}
