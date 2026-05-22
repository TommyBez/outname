import 'server-only'
import type { StateAdapter } from 'chat'
import { createChannelRedisState } from '@/channels/server/backing-state'

export function createSlackBackingState(): StateAdapter {
  // Redis keeps locks, queue, dedupe, subscriptions, and ephemeral state shared
  // across Fluid Compute instances. SlackHybridState only intercepts installation keys.
  return createChannelRedisState('slack')
}
