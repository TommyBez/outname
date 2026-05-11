import 'server-only'
import { createMemoryState } from '@chat-adapter/state-memory'
import { createRedisState } from '@chat-adapter/state-redis'
import type { StateAdapter } from 'chat'

let warned = false

export function createSlackBackingState(): StateAdapter {
  const url = process.env.REDIS_URL
  if (url) {
    // Redis keeps locks and thread subscriptions shared across instances.
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
