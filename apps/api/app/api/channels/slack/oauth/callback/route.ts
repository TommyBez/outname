import { auth } from '@outname/auth/server/auth'
import { hasSlackIntegrationAccess } from '@outname/auth/server/auth-guard'
import { buildAppUrl } from '@outname/shared/app-url'
import {
  getSlackAdapter,
  getSlackBot,
} from '@outname/shared/channels/slack/server/bot'
import {
  decodeSlackOAuthState,
  slackOAuthRedirectUri,
} from '@outname/shared/channels/slack/server/oauth-state'
import { withInstallContext } from '@outname/shared/channels/slack/server/state'
import { headers } from 'next/headers'
import { type NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest): Promise<Response> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return redirectToChannels({
      connection: 'error',
      reason: 'unauthorized',
    })
  }

  if (!(await hasSlackIntegrationAccess(session.user.id))) {
    return redirectToChannels({
      connection: 'error',
      reason: 'Slack integration is coming soon for your account.',
    })
  }

  const url = new URL(request.url)
  const stateParam = url.searchParams.get('state')
  // The signed state must round-trip the same session user before we save any install.
  const decoded = stateParam ? decodeSlackOAuthState(stateParam) : null
  const returnTo = decoded?.userId === session.user.id ? decoded.returnTo : null
  const error = url.searchParams.get('error')
  if (error) {
    return redirectToChannels(
      {
        connection: 'error',
        reason: `slack: ${error}`,
      },
      returnTo
    )
  }
  if (!stateParam) {
    return redirectToChannels({
      connection: 'error',
      reason: 'missing state',
    })
  }

  if (!decoded) {
    return redirectToChannels({
      connection: 'error',
      reason: 'invalid state',
    })
  }
  if (decoded.userId !== session.user.id) {
    return redirectToChannels({
      connection: 'error',
      reason: 'state does not match session user',
    })
  }
  const redirectUri = slackOAuthRedirectUri()

  try {
    // OAuth bypasses the webhook bootstrap path, so initialize the Chat bundle first.
    await getSlackBot().initialize()
    await withInstallContext({ userId: session.user.id }, () =>
      getSlackAdapter().handleOAuthCallback(request, { redirectUri })
    )
    return redirectToChannels(
      {
        connection: 'connected',
        provider: 'slack',
      },
      returnTo
    )
  } catch (err) {
    console.error('[slack-oauth] handleOAuthCallback failed', err)
    return redirectToChannels(
      {
        connection: 'error',
        reason: err instanceof Error ? err.message : 'oauth failed',
      },
      returnTo
    )
  }
}

function redirectToChannels(
  params: Record<string, string>,
  returnTo: string | null = null
): Response {
  return NextResponse.redirect(buildAppUrl(returnTo ?? '/channels', params))
}
