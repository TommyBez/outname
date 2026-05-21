import 'server-only'
import { Redis } from '@upstash/redis'

let upstashRedisClient: Redis | null | undefined

export function getUpstashRedis(): Redis | null {
  if (upstashRedisClient !== undefined) {
    return upstashRedisClient
  }

  const url = process.env.KV_REST_API_URL
  const token = process.env.KV_REST_API_TOKEN
  upstashRedisClient = url && token ? new Redis({ token, url }) : null
  return upstashRedisClient
}
