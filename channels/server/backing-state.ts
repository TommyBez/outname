import 'server-only'
import { createRedisState } from '@chat-adapter/state-redis'
import type { StateAdapter } from 'chat'
import type { ChannelId } from './types'

export function createChannelRedisState(channel: ChannelId): StateAdapter {
  const url = process.env.REDIS_URL
  if (!url) {
    throw new Error(`REDIS_URL is required for ${channel} Chat SDK state.`)
  }
  return createRedisState({ url, keyPrefix: `${channel}-chat-sdk` })
}
