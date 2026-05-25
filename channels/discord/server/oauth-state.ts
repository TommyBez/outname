import 'server-only'

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

const OAUTH_STATE_TTL_SECONDS = 60 * 10

export interface DiscordOAuthState {
  returnTo: string | null
  userId: string
}

export function encodeDiscordOAuthState(input: DiscordOAuthState): string {
  const secret = getOAuthStateSecret()
  const payload = {
    exp: Math.floor(Date.now() / 1000) + OAUTH_STATE_TTL_SECONDS,
    nonce: randomBytes(16).toString('hex'),
    returnTo: input.returnTo,
    userId: input.userId,
  }
  const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString(
    'base64url'
  )
  const signature = createHmac('sha256', secret)
    .update(encodedPayload)
    .digest('base64url')

  return `${encodedPayload}.${signature}`
}

export function decodeDiscordOAuthState(raw: string): DiscordOAuthState | null {
  try {
    const secret = getOAuthStateSecret()
    const [encodedPayload, signature] = raw.split('.')
    if (!(encodedPayload && signature)) {
      return null
    }

    const expectedSignature = createHmac('sha256', secret)
      .update(encodedPayload)
      .digest('base64url')

    const expectedBuffer = Buffer.from(expectedSignature, 'utf8')
    const signatureBuffer = Buffer.from(signature, 'utf8')
    if (
      expectedBuffer.length !== signatureBuffer.length ||
      !timingSafeEqual(expectedBuffer, signatureBuffer)
    ) {
      return null
    }

    const payloadText = Buffer.from(encodedPayload, 'base64url').toString(
      'utf8'
    )
    const payload = JSON.parse(payloadText) as {
      exp?: unknown
      returnTo?: unknown
      userId?: unknown
    }
    if (typeof payload.userId !== 'string' || typeof payload.exp !== 'number') {
      return null
    }

    if (Math.floor(Date.now() / 1000) > payload.exp) {
      return null
    }

    return {
      returnTo:
        typeof payload.returnTo === 'string'
          ? normalizeDiscordOAuthReturnTo(payload.returnTo)
          : null,
      userId: payload.userId,
    }
  } catch {
    return null
  }
}

export function normalizeDiscordOAuthReturnTo(
  raw: string | null
): string | null {
  if (!raw?.startsWith('/') || raw.startsWith('//')) {
    return null
  }

  try {
    const target = new URL(raw, 'https://outna.me')
    return `${target.pathname}${target.search}${target.hash}`
  } catch {
    return null
  }
}

function getOAuthStateSecret(): string {
  const secret = process.env.BETTER_AUTH_SECRET
  if (!secret) {
    throw new Error('BETTER_AUTH_SECRET must be set to sign OAuth state.')
  }
  return secret
}
