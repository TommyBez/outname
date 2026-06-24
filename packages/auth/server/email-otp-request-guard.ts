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

async function enforceOtpRequestLimits(request: Request, email: string) {
  const ipLimiter = getOtpIpRateLimiter()
  const ipRateLimitResult = await ipLimiter.limit(`ip:${getRequestIp(request)}`)
  await ipRateLimitResult.pending
  if (!ipRateLimitResult.success) {
    return rateLimitResponse()
  }

  const emailLimiter = getOtpEmailRateLimiter()
  const emailRateLimitResult = await emailLimiter.limit(`email:${email}`)
  await emailRateLimitResult.pending
  if (!emailRateLimitResult.success) {
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
