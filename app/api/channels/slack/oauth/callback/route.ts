import { headers } from 'next/headers'
import { type NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getSlackAdapter, getSlackBot } from '@/lib/channels/slack/bot'
import { withInstallContext } from '@/lib/channels/slack/state'

const TRAILING_SLASH = /\/$/

/**
 * GET /api/channels/slack/oauth/callback
 *
 * Slack redirects here after the user authorises the app. We:
 *
 *   1. Verify the session — the `state` param carries the originating
 *      user id and session token so a leaked callback URL can't be
 *      replayed against a different account.
 *   2. Run `slackAdapter.handleOAuthCallback` inside an
 *      `installContext` scope so the bridging state adapter
 *      (`SlackHybridState`) knows which user owns the resulting bot
 *      token. The token is encrypted at rest in `channel_installations`.
 *
 * After install, the operator can bind any Slack channel/DM to one of
 * their agents via `upsertAgentChannelBinding`.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const url = new URL(request.url)
  const stateParam = url.searchParams.get('state')
  const error = url.searchParams.get('error')
  if (error) {
    return redirectToSettings(request, {
      connection: 'error',
      reason: `slack: ${error}`,
    })
  }
  if (!stateParam) {
    return redirectToSettings(request, {
      connection: 'error',
      reason: 'missing state',
    })
  }

  const decoded = decodeOAuthState(stateParam)
  if (!decoded) {
    return redirectToSettings(request, {
      connection: 'error',
      reason: 'invalid state',
    })
  }
  if (decoded.userId !== session.user.id) {
    return redirectToSettings(request, {
      connection: 'error',
      reason: 'state does not match session user',
    })
  }
  if (decoded.sessionToken !== session.session.token) {
    return redirectToSettings(request, {
      connection: 'error',
      reason: 'state does not match active session',
    })
  }

  const baseUrl = process.env.BETTER_AUTH_URL
  if (!baseUrl) {
    return NextResponse.json(
      { error: 'BETTER_AUTH_URL must be set' },
      { status: 500 }
    )
  }
  const redirectUri = `${baseUrl.replace(TRAILING_SLASH, '')}/api/channels/slack/oauth/callback`

  try {
    // OAuth uses the adapter directly, so we must initialize the Chat
    // bundle first. Webhook entrypoints do this automatically.
    await getSlackBot().initialize()
    await withInstallContext({ userId: session.user.id }, () =>
      getSlackAdapter().handleOAuthCallback(request, { redirectUri })
    )
    return redirectToSettings(request, {
      connection: 'connected',
      provider: 'slack',
    })
  } catch (err) {
    console.error('[slack-oauth] handleOAuthCallback failed', err)
    return redirectToSettings(request, {
      connection: 'error',
      reason: err instanceof Error ? err.message : 'oauth failed',
    })
  }
}

function redirectToSettings(
  request: NextRequest,
  params: Record<string, string>
): Response {
  const target = new URL('/settings', request.url)
  for (const [key, value] of Object.entries(params)) {
    target.searchParams.set(key, value)
  }
  return NextResponse.redirect(target)
}

function decodeOAuthState(
  raw: string
): { userId: string; sessionToken: string } | null {
  try {
    const decoded = Buffer.from(raw, 'base64url').toString('utf8')
    const sep = decoded.indexOf(':')
    if (sep <= 0) {
      return null
    }
    return {
      userId: decoded.slice(0, sep),
      sessionToken: decoded.slice(sep + 1),
    }
  } catch {
    return null
  }
}
