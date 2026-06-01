import { getSlackBot } from '@outname/shared/channels/slack/server/bot'
import { after, type NextRequest } from 'next/server'

// Reply within Slack's 3-second window, then keep processing in `after()` so long runs do not retry.
export function POST(request: NextRequest): Promise<Response> {
  return getSlackBot().webhooks.slack(request, {
    waitUntil: (task) => after(() => task),
  })
}
