import { auth } from '@outname/auth/server/auth'
import { hasSlackIntegrationAccess } from '@outname/auth/server/auth-guard'
import { buildAppUrl } from '@outname/shared/app-url'
import {
  encodeSlackOAuthState,
  normalizeSlackOAuthReturnTo,
  slackOAuthRedirectUri,
} from '@outname/shared/channels/slack/server/oauth-state'
import { headers } from 'next/headers'
import { type NextRequest, NextResponse } from 'next/server'

const SLACK_AUTHORIZE_URL = 'https://slack.com/oauth/v2/authorize'

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
    return redirectToApp('/login')
  }

  if (!(await hasSlackIntegrationAccess(session.user.id))) {
    return redirectToApp('/channels#slack', {
      connection: 'error',
      reason: 'Slack integration is coming soon for your account.',
    })
  }

  const returnTo = normalizeSlackOAuthReturnTo(
    request.nextUrl.searchParams.get('returnTo')
  )
  const clientId = process.env.SLACK_CLIENT_ID
  if (!clientId) {
    return redirectToApp(returnTo ?? '/channels', {
      connection: 'error',
      reason:
        'Slack multi-workspace install is not configured on this deployment.',
    })
  }

  const redirectUri = slackOAuthRedirectUri()
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

function redirectToApp(
  path: string,
  params?: Record<string, string>
): Response {
  return NextResponse.redirect(buildAppUrl(path, params))
}
