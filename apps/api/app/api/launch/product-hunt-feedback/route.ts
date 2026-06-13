import { db } from '@outname/db'
import { launchFeedback } from '@outname/db/schema'
import { PRODUCT_HUNT_LAUNCH } from '@outname/shared/launch/product-hunt'
import { denyIfBot } from '@outname/shared/server/botid-guard'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { nanoid } from 'nanoid'
import { connection, type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const FEEDBACK_RATE_LIMIT_MAX_REQUESTS = 6
const FEEDBACK_RATE_LIMIT_WINDOW = '10 m'

const emptyStringToNull = (value: unknown) => (value === '' ? null : value)

const feedbackRequestSchema = z.object({
  company: z.string().max(255).optional().nullable(),
  email: z.preprocess(emptyStringToNull, z.email().optional().nullable()),
  feedbackType: z.enum([
    'first-agent',
    'positioning',
    'trust',
    'vercel-stack',
    'other',
  ]),
  message: z.string().trim().min(20).max(2000),
  referrer: z.string().max(2048).optional().nullable(),
  source: z.string().max(120).optional().nullable(),
  utmCampaign: z.string().max(255).optional().nullable(),
  utmContent: z.string().max(255).optional().nullable(),
  utmMedium: z.string().max(255).optional().nullable(),
  utmSource: z.string().max(255).optional().nullable(),
})

let cachedLimiter: Ratelimit | null | undefined

function createFeedbackId(): string {
  return `lfbk_${nanoid(12)}`
}

function genericSuccessResponse() {
  return NextResponse.json({
    message: 'Feedback received. Thank you.',
    ok: true,
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

  return request.headers.get('x-real-ip') ?? 'unknown'
}

function getFeedbackRateLimiter(): Ratelimit | null {
  if (cachedLimiter !== undefined) {
    return cachedLimiter
  }

  if (!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)) {
    cachedLimiter = null
    return cachedLimiter
  }

  cachedLimiter = new Ratelimit({
    analytics: false,
    limiter: Ratelimit.slidingWindow(
      FEEDBACK_RATE_LIMIT_MAX_REQUESTS,
      FEEDBACK_RATE_LIMIT_WINDOW
    ),
    prefix: 'launch:product-hunt-feedback:ip',
    redis: Redis.fromEnv(),
  })
  return cachedLimiter
}

async function checkRateLimit(request: NextRequest): Promise<boolean> {
  const limiter = getFeedbackRateLimiter()
  if (!limiter) {
    return true
  }

  const result = await limiter.limit(getRequestIp(request))
  await result.pending
  return result.success
}

export async function POST(request: NextRequest) {
  await connection()

  const botDenied = await denyIfBot(request)
  if (botDenied) {
    return botDenied
  }

  if (!(await checkRateLimit(request))) {
    return NextResponse.json({ error: 'rate limit exceeded' }, { status: 429 })
  }

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const parsed = feedbackRequestSchema.safeParse(payload)
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid payload' }, { status: 400 })
  }

  if ((parsed.data.company ?? '').trim().length > 0) {
    return genericSuccessResponse()
  }

  try {
    await db.insert(launchFeedback).values({
      email: parsed.data.email,
      feedbackType: parsed.data.feedbackType,
      id: createFeedbackId(),
      launchKey: PRODUCT_HUNT_LAUNCH.campaign,
      message: parsed.data.message,
      referrer: parsed.data.referrer,
      source: parsed.data.source,
      userAgent: request.headers.get('user-agent'),
      utmCampaign: parsed.data.utmCampaign,
      utmContent: parsed.data.utmContent,
      utmMedium: parsed.data.utmMedium,
      utmSource: parsed.data.utmSource,
    })
    return genericSuccessResponse()
  } catch (error) {
    console.error('[product-hunt-feedback] submit failed', error)
    return NextResponse.json({ error: 'internal error' }, { status: 500 })
  }
}
