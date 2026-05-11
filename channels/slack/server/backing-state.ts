import 'server-only'
import { createMemoryState } from '@chat-adapter/state-memory'
import { createRedisState } from '@chat-adapter/state-redis'
import type { StateAdapter } from 'chat'

/**
 * Pick the inner state backing for the Slack chat surface.
 *
 *   - When `REDIS_URL` is set we use `@chat-adapter/state-redis`. Locks
 *     and thread subscriptions become distributed, so multi-instance
 *     deployments stop double-processing the same Slack event and the
 *     SDK's "auto-reply in subscribed threads" behaviour survives cold
 *     starts. The Redis client is owned by the adapter and connects
 *     lazily on first use.
 *   - Otherwise we fall back to `@chat-adapter/state-memory`, which is
 *     fine for single-instance deployments and for local development.
 *     A warning is logged once at boot so the operator notices.
 *
 * Slack installation persistence is handled by `SlackHybridState`
 * irrespective of this choice — those keys always go to Postgres.
 */

let warned = false

export function createSlackBackingState(): StateAdapter {
  const url = process.env.REDIS_URL
  if (url) {
    return createRedisState({ url, keyPrefix: 'slack-chat-sdk' })
  }
  if (!warned) {
    warned = true
    console.warn(
      '[slack-state] REDIS_URL not set — using in-memory state. ' +
        'Locks and thread subscriptions will not survive across instances or cold starts. ' +
        'Set REDIS_URL for multi-instance deployments.'
    )
  }
  return createMemoryState()
}
