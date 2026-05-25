import { after, type NextRequest, NextResponse } from 'next/server'
import { getChannelsBot, getDiscordAdapter } from '@/channels/server/bot'

export const maxDuration = 300

const GATEWAY_DURATION_MS = 255_000
const GATEWAY_ABORT_MS = 265_000
const TRAILING_SLASH = /\/$/

export async function GET(request: NextRequest): Promise<Response> {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')
  if (!(cronSecret && authHeader === `Bearer ${cronSecret}`)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const bot = await getChannelsBot()
  await bot.initialize()
  const adapter = await getDiscordAdapter()
  return adapter.startGatewayListener(
    {
      waitUntil: (task) => after(() => task),
    },
    GATEWAY_DURATION_MS,
    AbortSignal.timeout(GATEWAY_ABORT_MS),
    discordEventsWebhookUrl()
  )
}

function discordEventsWebhookUrl(): string {
  const baseUrl = process.env.BETTER_AUTH_URL
  if (!baseUrl) {
    throw new Error(
      'BETTER_AUTH_URL must be set for Discord Gateway forwarding.'
    )
  }
  return `${baseUrl.replace(TRAILING_SLASH, '')}/api/channels/discord/events`
}
