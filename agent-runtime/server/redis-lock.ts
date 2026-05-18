import 'server-only'
import { nanoid } from 'nanoid'
import { getUpstashRedis } from '@/shared/server/upstash-redis'

export async function withRedisLock<T>(
  key: string,
  ttlSeconds: number,
  fn: () => Promise<T>
): Promise<T | null> {
  const redis = getUpstashRedis()
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
