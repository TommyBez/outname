import { after, type NextRequest, NextResponse } from 'next/server'
import { getChannelsBot } from '@/channels/server/bot'
import {
  getChannelProvider,
  isChannelId,
} from '@/channels/server/provider-registry'

interface RouteContext {
  params: Promise<{ channel: string }>
}

// Provider webhooks need a fast acknowledgement; Chat SDK continues work via `waitUntil`.
export async function POST(
  request: NextRequest,
  context: RouteContext
): Promise<Response> {
  const { channel: rawChannel } = await context.params
  if (!isChannelId(rawChannel)) {
    return NextResponse.json({ error: 'unsupported channel' }, { status: 404 })
  }

  const provider = getChannelProvider(rawChannel)
  if (!provider.isConfigured()) {
    return NextResponse.json(
      { error: provider.missingConfigMessage() },
      { status: 500 }
    )
  }

  const bot = await getChannelsBot()
  const webhook = bot.webhooks[rawChannel]
  if (!webhook) {
    return NextResponse.json(
      { error: `No webhook handler registered for ${rawChannel}.` },
      { status: 500 }
    )
  }

  return webhook(request, {
    waitUntil: (task) => after(() => task),
  })
}
