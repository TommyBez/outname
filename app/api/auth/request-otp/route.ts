import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/auth/server/auth'
import { db } from '@/shared/db'
import { user } from '@/shared/db/schema'
import {
  getWaitlistEntryByEmail,
  provisionWaitlistAccessByEmail,
} from '@/waitlist/server/service'

const requestOtpSchema = z.object({
  email: z.string().email(),
})

const REQUEST_SUCCESS_MESSAGE =
  'Check your inbox for a 6-digit sign-in code. It expires after 10 minutes.'

export async function POST(request: Request) {
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
  try {
    const [existingUser] = await db
      .select({
        id: user.id,
      })
      .from(user)
      .where(eq(user.email, email))
      .limit(1)

    if (!existingUser) {
      const waitlistEntry = await getWaitlistEntryByEmail(email)
      if (!waitlistEntry) {
        return NextResponse.json(
          {
            error:
              'This email does not have access yet. Join the waitlist first.',
          },
          { status: 403 }
        )
      }

      if (waitlistEntry.status === 'pending') {
        return NextResponse.json(
          {
            error:
              'Confirm your waitlist email before requesting a sign-in code.',
          },
          { status: 403 }
        )
      }

      if (
        waitlistEntry.status === 'confirmed' ||
        waitlistEntry.status === 'invited' ||
        waitlistEntry.status === 'converted'
      ) {
        await provisionWaitlistAccessByEmail(email)
      } else if (waitlistEntry.status === 'unsubscribed') {
        return NextResponse.json(
          {
            error:
              'This waitlist request is inactive. Join again to restore access.',
          },
          { status: 403 }
        )
      }
    }

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
