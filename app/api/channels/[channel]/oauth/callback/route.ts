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
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const provider = getChannelProvider(rawChannel)
  if (!provider.isConfigured()) {
    return NextResponse.json(
      { error: provider.missingConfigMessage() },
      { status: 500 }
    )
  }

  return provider.handleOAuthCallback(request, session)
}
