import { headers } from 'next/headers'
import { type NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getSlackAdapter } from '@/lib/channels/slack/bot'
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
    return NextResponse.json({ error: `slack: ${error}` }, { status: 400 })
  }
  if (!stateParam) {
    return NextResponse.json({ error: 'missing state' }, { status: 400 })
  }

  const decoded = decodeOAuthState(stateParam)
  if (!decoded) {
    return NextResponse.json({ error: 'invalid state' }, { status: 400 })
  }
  if (decoded.userId !== session.user.id) {
    return NextResponse.json(
      { error: 'state does not match session user' },
      { status: 401 }
    )
  }
  if (decoded.sessionToken !== session.session.token) {
    return NextResponse.json(
      { error: 'state does not match active session' },
      { status: 401 }
    )
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
    const { teamId } = await withInstallContext(
      { userId: session.user.id },
      () => getSlackAdapter().handleOAuthCallback(request, { redirectUri })
    )
    return NextResponse.json({
      ok: true,
      teamId,
      message: `Slack workspace ${teamId} installed for user ${session.user.id}.`,
    })
  } catch (err) {
    console.error('[slack-oauth] handleOAuthCallback failed', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'oauth failed' },
      { status: 500 }
    )
  }
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
