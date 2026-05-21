import 'server-only'
import { createRedisState } from '@chat-adapter/state-redis'
import type { StateAdapter } from 'chat'

export function createSlackBackingState(): StateAdapter {
  const url = process.env.REDIS_URL
  if (!url) {
    throw new Error('REDIS_URL is required for Slack Chat SDK state.')
  }
  // Redis keeps locks, queue, dedupe, subscriptions, and ephemeral state shared
  // across Fluid Compute instances. SlackHybridState only intercepts installation keys.
  return createRedisState({ url, keyPrefix: 'slack-chat-sdk' })
}
