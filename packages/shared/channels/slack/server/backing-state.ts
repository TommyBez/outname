import 'server-only'
import { createChannelRedisState } from '@outname/shared/channels/server/backing-state'
import type { StateAdapter } from 'chat'

export function createSlackBackingState(): StateAdapter {
  // Redis keeps locks, queue, dedupe, subscriptions, and ephemeral state shared
  // across Fluid Compute instances. SlackHybridState only intercepts installation keys.
  return createChannelRedisState('slack')
}
