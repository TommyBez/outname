import 'server-only'

import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import {
  WAITLIST_RATE_LIMIT_MAX_REQUESTS,
  WAITLIST_RATE_LIMIT_WINDOW,
} from '@/waitlist/server/constants'

let cachedRedis: Redis | null | undefined
let cachedLimiter: Ratelimit | null | undefined

function getRedisClient(): Redis | null {
  if (cachedRedis !== undefined) {
    return cachedRedis
  }
  if (!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)) {
    cachedRedis = null
    return cachedRedis
  }
  cachedRedis = Redis.fromEnv()
  return cachedRedis
}

export function getWaitlistRateLimiter(): Ratelimit | null {
  if (cachedLimiter !== undefined) {
    return cachedLimiter
  }
  const redis = getRedisClient()
  if (!redis) {
    cachedLimiter = null
    return cachedLimiter
  }
  cachedLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(
      WAITLIST_RATE_LIMIT_MAX_REQUESTS,
      WAITLIST_RATE_LIMIT_WINDOW
    ),
    analytics: false,
    prefix: 'waitlist:submit:ip',
  })
  return cachedLimiter
}
