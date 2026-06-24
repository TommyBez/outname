import 'server-only'

import {
  getOtpEmailRateLimiter,
  getOtpIpRateLimiter,
} from '@outname/auth/server/request-otp-rate-limit'
import type { BetterAuthPlugin } from 'better-auth'
import { createAuthMiddleware } from 'better-auth/api'
import { z } from 'zod'

const REQUEST_OTP_RATE_LIMIT_MESSAGE =
  'Too many sign-in code requests. Please wait a minute and try again.'

const sendVerificationOtpSchema = z.object({
  email: z.string().email(),
  type: z.literal('sign-in'),
})

interface RateLimitResult {
  pending: Promise<unknown>
  success: boolean
}

interface RateLimiter {
  limit: (key: string) => Promise<RateLimitResult>
}

function getRequestIp(request: Request): string {
  if (request.headers instanceof Headers) {
    const forwardedFor = request.headers.get('x-forwarded-for')
    if (forwardedFor) {
      const [ip] = forwardedFor.split(',')
      if (ip) {
        return ip.trim()
      }
    }

    const realIp = request.headers.get('x-real-ip')
    if (realIp) {
      return realIp
    }
  }

  return 'unknown'
}

function rateLimitResponse(): Response {
  return Response.json(
    { error: REQUEST_OTP_RATE_LIMIT_MESSAGE },
    { status: 429 }
  )
}

function observePendingRateLimit(
  pending: Promise<unknown>,
  scope: string
): void {
  pending.catch((error) => {
    console.error(
      `[auth] ${scope} OTP rate-limit background write failed`,
      error
    )
  })
}

async function isRateLimited(input: {
  key: string
  limiter: RateLimiter
  scope: string
}): Promise<boolean> {
  try {
    const result = await input.limiter.limit(input.key)
    observePendingRateLimit(result.pending, input.scope)
    return !result.success
  } catch (error) {
    console.error(`[auth] ${input.scope} OTP rate-limit check failed`, error)
    return false
  }
}

async function enforceOtpRequestLimits(request: Request, email: string) {
  if (
    await isRateLimited({
      key: `ip:${getRequestIp(request)}`,
      limiter: getOtpIpRateLimiter(),
      scope: 'ip',
    })
  ) {
    return rateLimitResponse()
  }

  if (
    await isRateLimited({
      key: `email:${email}`,
      limiter: getOtpEmailRateLimiter(),
      scope: 'email',
    })
  ) {
    return rateLimitResponse()
  }

  return
}

export function emailOtpRequestGuardPlugin() {
  return {
    id: 'email-otp-request-guard',
    hooks: {
      before: [
        {
          matcher(context) {
            return context.path === '/email-otp/send-verification-otp'
          },
          handler: createAuthMiddleware(async (context) => {
            const parsed = sendVerificationOtpSchema.safeParse(context.body)
            if (!(parsed.success && context.request)) {
              return
            }

            const response = await enforceOtpRequestLimits(
              context.request,
              parsed.data.email.trim().toLowerCase()
            )
            return response
          }),
        },
      ],
    },
  } satisfies BetterAuthPlugin
}
