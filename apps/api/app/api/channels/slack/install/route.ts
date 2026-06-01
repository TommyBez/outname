import { auth } from '@outname/auth/server/auth'
import { hasSlackIntegrationAccess } from '@outname/auth/server/auth-guard'
import {
  encodeSlackOAuthState,
  normalizeSlackOAuthReturnTo,
} from '@outname/shared/channels/slack/server/oauth-state'
import { headers } from 'next/headers'
import { type NextRequest, NextResponse } from 'next/server'

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

export async function GET(request: NextRequest): Promise<Response> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    const target = new URL('/login', request.url)
    return NextResponse.redirect(target)
  }

  if (!(await hasSlackIntegrationAccess(session.user.id))) {
    const target = new URL('/channels#slack', request.url)
    target.searchParams.set('connection', 'error')
    target.searchParams.set(
      'reason',
      'Slack integration is coming soon for your account.'
    )
    return NextResponse.redirect(target)
  }

  const returnTo = normalizeSlackOAuthReturnTo(
    request.nextUrl.searchParams.get('returnTo')
  )
  const clientId = process.env.SLACK_CLIENT_ID
  if (!clientId) {
    const target = new URL(returnTo ?? '/channels', request.url)
    target.searchParams.set('connection', 'error')
    target.searchParams.set(
      'reason',
      'Slack multi-workspace install is not configured on this deployment.'
    )
    return NextResponse.redirect(target)
  }

  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL
  if (!baseUrl) {
    return NextResponse.json(
      {
        error:
          'NEXT_PUBLIC_API_BASE_URL must be set to build the OAuth redirect URI.',
      },
      { status: 500 }
    )
  }

  const redirectUri = `${baseUrl.replace(TRAILING_SLASH, '')}/api/channels/slack/oauth/callback`
  // The signed state binds the eventual callback to the current app user.
  const state = encodeSlackOAuthState({
    userId: session.user.id,
    returnTo,
  })
  const params = new URLSearchParams({
    client_id: clientId,
    scope: DEFAULT_BOT_SCOPES.join(','),
    redirect_uri: redirectUri,
    state,
  })

  return NextResponse.redirect(`${SLACK_AUTHORIZE_URL}?${params.toString()}`)
}
