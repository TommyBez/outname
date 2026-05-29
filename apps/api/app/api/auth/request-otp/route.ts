import { auth } from '@outname/auth/server/auth'
import {
  getOtpEmailRateLimiter,
  getOtpIpRateLimiter,
} from '@outname/auth/server/request-otp-rate-limit'
import { db } from '@outname/db'
import { user } from '@outname/db/schema'
import {
  API_DEBUG_REQUEST_ID_HEADER,
  getApiDebugHeaderSnapshot,
  getApiDebugRequestId,
  logApiDebug,
} from '@outname/shared/server/api-debug'
import { denyIfBot } from '@outname/shared/server/botid-guard'
import {
  getWaitlistEntryByEmail,
  provisionWaitlistAccessByEmail,
} from '@outname/shared/waitlist/server/service'
import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const requestOtpSchema = z.object({
  email: z.string().email(),
})

const REQUEST_SUCCESS_MESSAGE =
  'Check your inbox for a 6-digit sign-in code. It expires after 10 minutes.'
const REQUEST_OTP_RATE_LIMIT_MESSAGE =
  'Too many sign-in code requests. Please wait a minute and try again.'

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

function withDebugHeader(response: NextResponse, requestId: string) {
  response.headers.set(API_DEBUG_REQUEST_ID_HEADER, requestId)
  return response
}

function getEmailDebugInfo(email: string) {
  const atIndex = email.lastIndexOf('@')
  return {
    domain: atIndex >= 0 ? email.slice(atIndex + 1) : null,
    length: email.length,
  }
}

function getErrorDebugInfo(error: unknown) {
  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name,
      stack: error.stack,
    }
  }

  return String(error)
}

export async function POST(request: Request) {
  const requestId = getApiDebugRequestId(request.headers)

  logApiDebug('request-otp:start', {
    headers: getApiDebugHeaderSnapshot(request.headers),
    method: 'POST',
    requestId,
  })

  const botDenied = await denyIfBot(request)
  if (botDenied) {
    logApiDebug('request-otp:blocked-by-botid', { requestId })
    return withDebugHeader(botDenied, requestId)
  }

  const ipLimiter = getOtpIpRateLimiter()
  const ipRateLimitResult = await ipLimiter.limit(`ip:${getRequestIp(request)}`)
  await ipRateLimitResult.pending
  if (!ipRateLimitResult.success) {
    logApiDebug('request-otp:ip-rate-limited', { requestId })
    return withDebugHeader(
      NextResponse.json(
        { error: REQUEST_OTP_RATE_LIMIT_MESSAGE },
        { status: 429 }
      ),
      requestId
    )
  }

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    logApiDebug('request-otp:invalid-json', { requestId })
    return withDebugHeader(
      NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 }),
      requestId
    )
  }

  const parsed = requestOtpSchema.safeParse(payload)
  if (!parsed.success) {
    logApiDebug('request-otp:invalid-email', { requestId })
    return withDebugHeader(
      NextResponse.json(
        { error: 'Enter a valid email address' },
        { status: 400 }
      ),
      requestId
    )
  }

  const email = parsed.data.email.trim().toLowerCase()
  const emailDebug = getEmailDebugInfo(email)
  logApiDebug('request-otp:payload-valid', {
    email: emailDebug,
    requestId,
  })

  const emailLimiter = getOtpEmailRateLimiter()
  const emailRateLimitResult = await emailLimiter.limit(`email:${email}`)
  await emailRateLimitResult.pending
  if (!emailRateLimitResult.success) {
    logApiDebug('request-otp:email-rate-limited', {
      email: emailDebug,
      requestId,
    })
    return withDebugHeader(
      NextResponse.json(
        { error: REQUEST_OTP_RATE_LIMIT_MESSAGE },
        { status: 429 }
      ),
      requestId
    )
  }

  try {
    logApiDebug('request-otp:user-lookup-start', {
      email: emailDebug,
      requestId,
    })

    const [existingUser] = await db
      .select({
        id: user.id,
      })
      .from(user)
      .where(eq(user.email, email))
      .limit(1)

    logApiDebug('request-otp:user-lookup-complete', {
      email: emailDebug,
      existingUserFound: Boolean(existingUser),
      requestId,
    })

    if (!existingUser) {
      const waitlistEntry = await getWaitlistEntryByEmail(email)
      logApiDebug('request-otp:waitlist-lookup-complete', {
        email: emailDebug,
        requestId,
        waitlistStatus: waitlistEntry?.status ?? null,
      })

      if (!waitlistEntry) {
        return withDebugHeader(
          NextResponse.json(
            {
              error:
                'This email does not have access yet. Join the waitlist first.',
            },
            { status: 403 }
          ),
          requestId
        )
      }

      if (waitlistEntry.status === 'pending') {
        return withDebugHeader(
          NextResponse.json(
            {
              error:
                'Confirm your waitlist email before requesting a sign-in code.',
            },
            { status: 403 }
          ),
          requestId
        )
      }

      if (waitlistEntry.status === 'confirmed') {
        return withDebugHeader(
          NextResponse.json(
            {
              error:
                'Your waitlist email is confirmed. Access must be granted before you can sign in.',
            },
            { status: 403 }
          ),
          requestId
        )
      }

      if (
        waitlistEntry.status === 'invited' ||
        waitlistEntry.status === 'converted'
      ) {
        logApiDebug('request-otp:provision-waitlist-access-start', {
          email: emailDebug,
          requestId,
          waitlistStatus: waitlistEntry.status,
        })
        await provisionWaitlistAccessByEmail(email)
        logApiDebug('request-otp:provision-waitlist-access-complete', {
          email: emailDebug,
          requestId,
          waitlistStatus: waitlistEntry.status,
        })
      } else if (waitlistEntry.status === 'unsubscribed') {
        return withDebugHeader(
          NextResponse.json(
            {
              error:
                'This waitlist request is inactive. Join again to restore access.',
            },
            { status: 403 }
          ),
          requestId
        )
      }
    }

    logApiDebug('request-otp:send-otp-start', {
      email: emailDebug,
      requestId,
    })

    await auth.api.sendVerificationOTP({
      body: {
        email,
        type: 'sign-in',
      },
    })
    logApiDebug('request-otp:send-otp-complete', {
      email: emailDebug,
      requestId,
    })
  } catch (error) {
    logApiDebug('request-otp:error', {
      error: getErrorDebugInfo(error),
      requestId,
    })
    console.error('[auth] otp request failed', { error, requestId })
    return withDebugHeader(
      NextResponse.json(
        { error: 'Could not send a sign-in code right now.' },
        { status: 500 }
      ),
      requestId
    )
  }

  return withDebugHeader(
    NextResponse.json({
      message: REQUEST_SUCCESS_MESSAGE,
      ok: true,
    }),
    requestId
  )
}
