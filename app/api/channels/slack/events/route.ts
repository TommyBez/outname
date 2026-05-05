import { after, type NextRequest } from 'next/server'
import { getSlackBot } from '@/lib/channels/slack/bot'

/**
 * POST /api/channels/slack/events
 *
 * Slack Events API webhook. The Vercel Chat SDK's Slack adapter owns:
 *
 *   - Signing-secret verification (HMAC over raw body)
 *   - URL verification challenge handshake
 *   - Event de-duplication
 *   - Routing the event into our `onNewMention` / `onSubscribedMessage`
 *     handlers in `lib/channels/slack/bot.ts`
 *
 * Slack expects a 200 within 3 seconds. We hand the heavy lifting to
 * `after()` (Next.js's wrapper around `waitUntil`) so the agent
 * workflow run + Slack API streaming continue after the response is
 * already on the wire — a single 5-minute model run won't cause Slack
 * to retry the same event five times.
 */
export function POST(request: NextRequest): Promise<Response> {
  return getSlackBot().webhooks.slack(request, {
    waitUntil: (task) => after(() => task),
  })
}
