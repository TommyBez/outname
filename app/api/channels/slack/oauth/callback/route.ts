import { headers } from 'next/headers'
import { type NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth/server/auth'
import { getSlackAdapter, getSlackBot } from '@/channels/slack/server/bot'
import { decodeSlackOAuthState } from '@/channels/slack/server/oauth-state'
import { withInstallContext } from '@/channels/slack/server/state'

const TRAILING_SLASH = /\/$/

export async function GET(request: NextRequest): Promise<Response> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const url = new URL(request.url)
  const stateParam = url.searchParams.get('state')
  // The signed state must round-trip the same session user before we save any install.
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
  const baseUrl = process.env.BETTER_AUTH_URL
  if (!baseUrl) {
    return NextResponse.json(
      { error: 'BETTER_AUTH_URL must be set' },
      { status: 500 }
    )
  }
  const redirectUri = `${baseUrl.replace(TRAILING_SLASH, '')}/api/channels/slack/oauth/callback`

  try {
    // OAuth bypasses the webhook bootstrap path, so initialize the Chat bundle first.
    await getSlackBot().initialize()
    await withInstallContext({ userId: session.user.id }, () =>
      getSlackAdapter().handleOAuthCallback(request, { redirectUri })
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
