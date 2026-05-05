import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SLACK_AUTHORIZE_URL = 'https://slack.com/oauth/v2/authorize'
const TRAILING_SLASH = /\/$/

const DEFAULT_BOT_SCOPES = [
  'app_mentions:read',
  'channels:history',
  'chat:write',
  'groups:history',
  'im:history',
  'im:read',
  'im:write',
  'mpim:history',
  'users:read',
]

/**
 * GET /api/channels/slack/install
 *
 * Redirects the authenticated operator to the Slack OAuth consent
 * screen. Authentication is required so the eventual callback knows
 * which app user owns the resulting workspace install — that ownership
 * is the foundation of multi-user safety.
 *
 * The Slack `state` parameter carries the user id back to the callback;
 * we sign it with the Better Auth session so a leaked install link
 * can't be replayed against a different account.
 */
export async function GET(): Promise<Response> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const clientId = process.env.SLACK_CLIENT_ID
  if (!clientId) {
    return NextResponse.json(
      {
        error:
          'SLACK_CLIENT_ID is not configured. Multi-workspace install is disabled.',
      },
      { status: 412 }
    )
  }

  const baseUrl = process.env.BETTER_AUTH_URL
  if (!baseUrl) {
    return NextResponse.json(
      { error: 'BETTER_AUTH_URL must be set to build the OAuth redirect URI.' },
      { status: 500 }
    )
  }

  const redirectUri = `${baseUrl.replace(TRAILING_SLASH, '')}/api/channels/slack/oauth/callback`
  const state = encodeOAuthState(session.user.id, session.session.token)
  const params = new URLSearchParams({
    client_id: clientId,
    scope: DEFAULT_BOT_SCOPES.join(','),
    redirect_uri: redirectUri,
    state,
  })

  return NextResponse.redirect(`${SLACK_AUTHORIZE_URL}?${params.toString()}`)
}

function encodeOAuthState(userId: string, sessionToken: string): string {
  return Buffer.from(`${userId}:${sessionToken}`, 'utf8').toString('base64url')
}
