import 'server-only'
import { Redis } from '@upstash/redis'
import { nanoid } from 'nanoid'

let redisClient: Redis | null | undefined

function getRedis(): Redis | null {
  if (redisClient !== undefined) {
    return redisClient
  }
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  redisClient = url && token ? new Redis({ token, url }) : null
  return redisClient
}

export async function withRedisLock<T>(
  key: string,
  ttlSeconds: number,
  fn: () => Promise<T>
): Promise<T | null> {
  const redis = getRedis()
  if (!redis) {
    return await fn()
  }

  const token = nanoid(16)
  const acquired = await redis.set(key, token, { ex: ttlSeconds, nx: true })
  if (acquired !== 'OK') {
    return null
  }

  try {
    return await fn()
  } finally {
    const current = await redis.get<string>(key)
    if (current === token) {
      await redis.del(key)
    }
  }
}
