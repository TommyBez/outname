import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'

export type AppRevalidationProfile = 'max' | { expire: 0 }

export interface AppRevalidationPayload {
  tags: [tag: string, profile: AppRevalidationProfile][]
}

export function signAppRevalidationBody(body: string): string {
  const secret = readAppRevalidationSecret()
  return createHmac('sha256', secret).update(body).digest('hex')
}

export function verifyAppRevalidationBody(input: {
  body: string
  signature: string | null
}): boolean {
  if (!input.signature) {
    return false
  }
  const expected = signAppRevalidationBody(input.body)
  const actualBuffer = Buffer.from(input.signature, 'hex')
  const expectedBuffer = Buffer.from(expected, 'hex')
  if (actualBuffer.length !== expectedBuffer.length) {
    return false
  }
  return timingSafeEqual(actualBuffer, expectedBuffer)
}

export function parseAppRevalidationPayload(
  value: unknown
): AppRevalidationPayload | null {
  if (typeof value !== 'object' || value === null || !('tags' in value)) {
    return null
  }
  const rawTags = Reflect.get(value, 'tags') as unknown
  if (!Array.isArray(rawTags)) {
    return null
  }

  const tags: AppRevalidationPayload['tags'] = []
  for (const item of rawTags) {
    if (!Array.isArray(item) || item.length !== 2) {
      return null
    }
    const [tag, profile] = item
    if (typeof tag !== 'string' || tag.length === 0) {
      return null
    }
    if (!isAppRevalidationProfile(profile)) {
      return null
    }
    tags.push([tag, profile])
  }

  return { tags }
}

function isAppRevalidationProfile(
  value: unknown
): value is AppRevalidationProfile {
  if (value === 'max') {
    return true
  }
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Reflect.get(value, 'expire') === 0
  )
}

function readAppRevalidationSecret(): string {
  const secret = process.env.APP_REVALIDATION_SECRET?.trim()
  if (!secret) {
    throw new Error('APP_REVALIDATION_SECRET is required for app revalidation.')
  }
  return secret
}
