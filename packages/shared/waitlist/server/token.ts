import 'server-only'

import { createHash, randomBytes } from 'node:crypto'
import { WAITLIST_CONFIRMATION_TOKEN_TTL_MS } from '@outname/shared/waitlist/server/constants'

export function hashWaitlistToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function issueWaitlistToken(now = new Date()) {
  const token = randomBytes(24).toString('base64url')
  return {
    token,
    hash: hashWaitlistToken(token),
    expiresAt: new Date(now.getTime() + WAITLIST_CONFIRMATION_TOKEN_TTL_MS),
  }
}
