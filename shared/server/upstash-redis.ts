import 'server-only'
import { Redis } from '@upstash/redis'

let upstashRedisClient: Redis | null | undefined

export function getUpstashRedis(): Redis | null {
  if (upstashRedisClient !== undefined) {
    return upstashRedisClient
  }

  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  upstashRedisClient = url && token ? new Redis({ token, url }) : null
  return upstashRedisClient
}
