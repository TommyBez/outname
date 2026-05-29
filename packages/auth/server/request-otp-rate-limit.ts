import 'server-only'

import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const OTP_REQUEST_RATE_LIMIT_MAX_REQUESTS = 3
const OTP_REQUEST_RATE_LIMIT_WINDOW = '1 m'
const OTP_REQUEST_RATE_LIMIT_WINDOW_MS = 60_000

interface RateLimitResult {
  pending: Promise<unknown>
  success: boolean
}

interface RateLimiter {
  limit: (key: string) => Promise<RateLimitResult>
}

type Scope = 'email' | 'ip'

const localBucketsByScope: Record<Scope, Map<string, number[]>> = {
  email: new Map<string, number[]>(),
  ip: new Map<string, number[]>(),
}

let cachedRedis: Redis | null | undefined
const cachedLimiters: Partial<Record<Scope, RateLimiter>> = {}

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

function cleanupExpiredEntries(entries: number[], now: number): number[] {
  return entries.filter(
    (timestamp) => now - timestamp < OTP_REQUEST_RATE_LIMIT_WINDOW_MS
  )
}

function createLocalRateLimiter(scope: Scope): RateLimiter {
  const store = localBucketsByScope[scope]

  return {
    limit(key: string) {
      const now = Date.now()
      const activeEntries = cleanupExpiredEntries(store.get(key) ?? [], now)
      const success = activeEntries.length < OTP_REQUEST_RATE_LIMIT_MAX_REQUESTS

      if (success) {
        activeEntries.push(now)
      }

      store.set(key, activeEntries)

      return Promise.resolve({
        pending: Promise.resolve(),
        success,
      })
    },
  }
}

function createRedisRateLimiter(scope: Scope, redis: Redis): RateLimiter {
  return new Ratelimit({
    analytics: false,
    limiter: Ratelimit.slidingWindow(
      OTP_REQUEST_RATE_LIMIT_MAX_REQUESTS,
      OTP_REQUEST_RATE_LIMIT_WINDOW
    ),
    prefix: `auth:request-otp:${scope}`,
    redis,
  })
}

function getRateLimiter(scope: Scope): RateLimiter {
  const cachedLimiter = cachedLimiters[scope]
  if (cachedLimiter) {
    return cachedLimiter
  }

  const redis = getRedisClient()
  const limiter = redis
    ? createRedisRateLimiter(scope, redis)
    : createLocalRateLimiter(scope)

  cachedLimiters[scope] = limiter
  return limiter
}

export function getOtpEmailRateLimiter(): RateLimiter {
  return getRateLimiter('email')
}

export function getOtpIpRateLimiter(): RateLimiter {
  return getRateLimiter('ip')
}
