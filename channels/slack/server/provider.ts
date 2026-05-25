import 'server-only'

import { type NextRequest, NextResponse } from 'next/server'
import type { Session } from '@/auth/server/auth'
import {
  getChannelsBot,
  getSlackAdapter,
  isChannelConfigured,
} from '@/channels/server/bot'
import type { ChannelProvider } from '@/channels/server/provider-registry'
import { withSlackInstallContext } from '@/channels/server/state'
import {
  decodeSlackOAuthState,
  encodeSlackOAuthState,
  normalizeSlackOAuthReturnTo,
} from './oauth-state'

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

export const slackChannelProvider: ChannelProvider = {
  channel: 'slack',
  async handleOAuthCallback(request, session) {
    return await handleSlackOAuthCallback(request, session)
  },
  isConfigured() {
    return isChannelConfigured('slack')
  },
  missingConfigMessage() {
    return 'Slack is not configured. Set SLACK_CLIENT_ID, SLACK_CLIENT_SECRET, and SLACK_SIGNING_SECRET.'
  },
  startInstall(request, session) {
    return startSlackInstall(request, session)
  },
}

function startSlackInstall(request: NextRequest, session: Session): Response {
  const returnTo = normalizeSlackOAuthReturnTo(
    request.nextUrl.searchParams.get('returnTo')
  )
  const clientId = process.env.SLACK_CLIENT_ID
  if (!clientId) {
    return redirectToChannels(
      request,
      {
        connection: 'error',
        reason: slackChannelProvider.missingConfigMessage(),
      },
      returnTo
    )
  }

  const redirectUri = channelCallbackUrl('slack')
  const state = encodeSlackOAuthState({
    returnTo,
    userId: session.user.id,
  })
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: DEFAULT_BOT_SCOPES.join(','),
    state,
  })

  return NextResponse.redirect(`${SLACK_AUTHORIZE_URL}?${params.toString()}`)
}

async function handleSlackOAuthCallback(
  request: NextRequest,
  session: Session
): Promise<Response> {
  const url = new URL(request.url)
  const stateParam = url.searchParams.get('state')
  const decoded = stateParam ? decodeSlackOAuthState(stateParam) : null
  const returnTo = decoded?.userId === session.user.id ? decoded.returnTo : null
  const error = url.searchParams.get('error')
  if (error) {
    return redirectToChannels(
      request,
      {
        connection: 'error',
        reason: `slack: ${error}`,
      },
      returnTo
    )
  }
  if (!stateParam) {
    return redirectToChannels(request, {
      connection: 'error',
      reason: 'missing state',
    })
  }

  if (!decoded) {
    return redirectToChannels(request, {
      connection: 'error',
      reason: 'invalid state',
    })
  }
  if (decoded.userId !== session.user.id) {
    return redirectToChannels(request, {
      connection: 'error',
      reason: 'state does not match session user',
    })
  }

  try {
    const bot = await getChannelsBot()
    await bot.initialize()
    const adapter = await getSlackAdapter()
    await withSlackInstallContext({ userId: session.user.id }, () =>
      adapter.handleOAuthCallback(request, {
        redirectUri: channelCallbackUrl('slack'),
      })
    )
    return redirectToChannels(
      request,
      {
        connection: 'connected',
        provider: 'slack',
      },
      returnTo
    )
  } catch (err) {
    console.error('[slack-oauth] handleOAuthCallback failed', err)
    return redirectToChannels(
      request,
      {
        connection: 'error',
        reason: err instanceof Error ? err.message : 'oauth failed',
      },
      returnTo
    )
  }
}

function channelCallbackUrl(channel: string): string {
  const baseUrl = process.env.BETTER_AUTH_URL
  if (!baseUrl) {
    throw new Error('BETTER_AUTH_URL must be set to build OAuth redirect URIs.')
  }
  return `${baseUrl.replace(TRAILING_SLASH, '')}/api/channels/${channel}/oauth/callback`
}

function redirectToChannels(
  request: NextRequest,
  params: Record<string, string>,
  returnTo: string | null = null
): Response {
  const target = new URL(returnTo ?? '/channels', request.url)
  for (const [key, value] of Object.entries(params)) {
    target.searchParams.set(key, value)
  }
  return NextResponse.redirect(target)
}
