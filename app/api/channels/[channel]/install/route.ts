import { headers } from 'next/headers'
import { type NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth/server/auth'
import {
  getChannelProvider,
  isChannelId,
} from '@/channels/server/provider-registry'

interface RouteContext {
  params: Promise<{ channel: string }>
}

export async function GET(
  request: NextRequest,
  context: RouteContext
): Promise<Response> {
  const { channel: rawChannel } = await context.params
  if (!isChannelId(rawChannel)) {
    return NextResponse.json({ error: 'unsupported channel' }, { status: 404 })
  }

  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const provider = getChannelProvider(rawChannel)
  if (!provider.isConfigured()) {
    return redirectToChannelsError(request, provider.missingConfigMessage())
  }

  return provider.startInstall(request, session)
}

function redirectToChannelsError(
  request: NextRequest,
  reason: string
): Response {
  const returnTo = request.nextUrl.searchParams.get('returnTo')
  const target =
    returnTo?.startsWith('/') && !returnTo.startsWith('//')
      ? new URL(returnTo, request.url)
      : new URL('/channels', request.url)
  target.searchParams.set('connection', 'error')
  target.searchParams.set('reason', reason)
  return NextResponse.redirect(target)
}
