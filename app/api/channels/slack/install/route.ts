import { createHmac, randomBytes } from 'node:crypto'
import { headers } from 'next/headers'
import { type NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'

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
 * The Slack `state` parameter carries a short-lived, signed value that
 * identifies the originating user without exposing bearer credentials.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    const target = new URL('/login', request.url)
    return NextResponse.redirect(target)
  }

  const clientId = process.env.SLACK_CLIENT_ID
  if (!clientId) {
    const target = new URL('/settings', request.url)
    target.searchParams.set('connection', 'error')
    target.searchParams.set(
      'reason',
      'Slack multi-workspace install is not configured on this deployment.'
    )
    return NextResponse.redirect(target)
  }

  const baseUrl = process.env.BETTER_AUTH_URL
  if (!baseUrl) {
    return NextResponse.json(
      { error: 'BETTER_AUTH_URL must be set to build the OAuth redirect URI.' },
      { status: 500 }
    )
  }

  const redirectUri = `${baseUrl.replace(TRAILING_SLASH, '')}/api/channels/slack/oauth/callback`
  const state = encodeOAuthState(session.user.id)
  const params = new URLSearchParams({
    client_id: clientId,
    scope: DEFAULT_BOT_SCOPES.join(','),
    redirect_uri: redirectUri,
    state,
  })

  return NextResponse.redirect(`${SLACK_AUTHORIZE_URL}?${params.toString()}`)
}

const OAUTH_STATE_TTL_SECONDS = 60 * 10

function encodeOAuthState(userId: string): string {
  const secret = process.env.BETTER_AUTH_SECRET
  if (!secret) {
    throw new Error('BETTER_AUTH_SECRET must be set to sign OAuth state.')
  }

  const payload = {
    userId,
    nonce: randomBytes(16).toString('hex'),
    exp: Math.floor(Date.now() / 1000) + OAUTH_STATE_TTL_SECONDS,
  }
  const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString(
    'base64url'
  )
  const signature = createHmac('sha256', secret)
    .update(encodedPayload)
    .digest('base64url')

  return `${encodedPayload}.${signature}`
}
