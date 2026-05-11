import { after, type NextRequest } from 'next/server'
import { getSlackBot } from '@/channels/slack/server/bot'

// Reply within Slack's 3-second window, then keep processing in `after()` so long runs do not retry.
export function POST(request: NextRequest): Promise<Response> {
  return getSlackBot().webhooks.slack(request, {
    waitUntil: (task) => after(() => task),
  })
}
