import 'server-only'

import { createHmac, timingSafeEqual } from 'node:crypto'

const WAITLIST_PREFERENCE_TOKEN_VERSION = 'v1'

function normalizeEmailForPreferenceToken(email: string): string {
  return email.trim().toLowerCase()
}

function getPreferenceTokenSecret(): string {
  const secret =
    process.env.BETTER_AUTH_SECRET ?? process.env.APP_REVALIDATION_SECRET
  if (!secret) {
    throw new Error(
      'BETTER_AUTH_SECRET or APP_REVALIDATION_SECRET is required for waitlist preference links'
    )
  }
  return secret
}

function signPreferencePayload(email: string): string {
  return createHmac('sha256', getPreferenceTokenSecret())
    .update(`${WAITLIST_PREFERENCE_TOKEN_VERSION}:waitlist:${email}`)
    .digest('base64url')
}

export function createWaitlistUnsubscribeToken(email: string): string {
  const normalizedEmail = normalizeEmailForPreferenceToken(email)
  return `${WAITLIST_PREFERENCE_TOKEN_VERSION}.${signPreferencePayload(
    normalizedEmail
  )}`
}

export function verifyWaitlistUnsubscribeToken(input: {
  email: string
  token: string
}): boolean {
  const normalizedEmail = normalizeEmailForPreferenceToken(input.email)
  const expected = createWaitlistUnsubscribeToken(normalizedEmail)

  const expectedBuffer = Buffer.from(expected)
  const actualBuffer = Buffer.from(input.token.trim())

  if (expectedBuffer.length !== actualBuffer.length) {
    return false
  }

  return timingSafeEqual(expectedBuffer, actualBuffer)
}
