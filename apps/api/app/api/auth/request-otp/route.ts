import { auth } from '@outname/auth/server/auth'
import {
  getOtpEmailRateLimiter,
  getOtpIpRateLimiter,
} from '@outname/auth/server/request-otp-rate-limit'
import { denyIfBot } from '@outname/shared/server/botid-guard'
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

export async function POST(request: Request) {
  const botDenied = await denyIfBot(request)
  if (botDenied) {
    return botDenied
  }

  const ipLimiter = getOtpIpRateLimiter()
  const ipRateLimitResult = await ipLimiter.limit(`ip:${getRequestIp(request)}`)
  await ipRateLimitResult.pending
  if (!ipRateLimitResult.success) {
    return NextResponse.json(
      { error: REQUEST_OTP_RATE_LIMIT_MESSAGE },
      { status: 429 }
    )
  }

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 })
  }

  const parsed = requestOtpSchema.safeParse(payload)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Enter a valid email address' },
      { status: 400 }
    )
  }

  const email = parsed.data.email.trim().toLowerCase()

  const emailLimiter = getOtpEmailRateLimiter()
  const emailRateLimitResult = await emailLimiter.limit(`email:${email}`)
  await emailRateLimitResult.pending
  if (!emailRateLimitResult.success) {
    return NextResponse.json(
      { error: REQUEST_OTP_RATE_LIMIT_MESSAGE },
      { status: 429 }
    )
  }

  try {
    await auth.api.sendVerificationOTP({
      body: {
        email,
        type: 'sign-in',
      },
    })
  } catch (error) {
    console.error('[auth] otp request failed', error)
    return NextResponse.json(
      { error: 'Could not send a sign-in code right now.' },
      { status: 500 }
    )
  }

  return NextResponse.json({
    message: REQUEST_SUCCESS_MESSAGE,
    ok: true,
  })
}
