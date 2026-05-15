import { connection, type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  WAITLIST_GENERIC_SUCCESS_MESSAGE,
  WAITLIST_PRIMARY_INTERESTS,
  WAITLIST_PROFILE_TYPES,
} from '@/waitlist/server/constants'
import { sendWaitlistConfirmationEmail } from '@/waitlist/server/email'
import { isWaitlistPublicEnabled } from '@/waitlist/server/public-config'
import { getWaitlistRateLimiter } from '@/waitlist/server/rate-limit'
import { submitWaitlistEntry } from '@/waitlist/server/service'

const waitlistRequestSchema = z.object({
  email: z.string().email(),
  name: z.string().max(120).optional().nullable(),
  primaryInterest: z.enum(WAITLIST_PRIMARY_INTERESTS).optional().nullable(),
  profileType: z.enum(WAITLIST_PROFILE_TYPES).optional().nullable(),
  useCase: z.string().max(2000).optional().nullable(),
  source: z.string().max(120).optional().nullable(),
  referrer: z.string().max(2048).optional().nullable(),
  utmCampaign: z.string().max(255).optional().nullable(),
  utmContent: z.string().max(255).optional().nullable(),
  utmMedium: z.string().max(255).optional().nullable(),
  utmSource: z.string().max(255).optional().nullable(),
  company: z.string().max(255).optional().nullable(),
})

function genericSuccessResponse() {
  return NextResponse.json({
    ok: true,
    message: WAITLIST_GENERIC_SUCCESS_MESSAGE,
  })
}

function getRequestIp(request: NextRequest): string {
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
  return 'unknown'
}

export async function POST(request: NextRequest) {
  await connection()

  if (!isWaitlistPublicEnabled()) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }

  const limiter = getWaitlistRateLimiter()
  if (!limiter) {
    return NextResponse.json(
      { error: 'waitlist rate limiting is not configured' },
      { status: 503 }
    )
  }

  const rateLimitResult = await limiter.limit(`ip:${getRequestIp(request)}`)
  await rateLimitResult.pending
  if (!rateLimitResult.success) {
    return NextResponse.json({ error: 'rate limit exceeded' }, { status: 429 })
  }

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const parsed = waitlistRequestSchema.safeParse(payload)
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid payload' }, { status: 400 })
  }

  if ((parsed.data.company ?? '').trim().length > 0) {
    return genericSuccessResponse()
  }

  try {
    const result = await submitWaitlistEntry(parsed.data)
    if (result.emailToSend) {
      try {
        await sendWaitlistConfirmationEmail(result.emailToSend)
      } catch (error) {
        console.error(
          '[waitlist] confirmation email send failed',
          result.entryId,
          error
        )
      }
    }
    return genericSuccessResponse()
  } catch (error) {
    console.error('[waitlist] submit failed', error)
    return NextResponse.json({ error: 'internal error' }, { status: 500 })
  }
}
