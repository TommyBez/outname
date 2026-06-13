import { buildEmailWebUrl } from '@outname/shared/server/email-urls'
import { verifyWaitlistUnsubscribeToken } from '@outname/shared/waitlist/server/preference-token'
import { unsubscribeWaitlistEntryByEmail } from '@outname/shared/waitlist/server/service'
import { type NextRequest, NextResponse } from 'next/server'

function buildRedirect(status: 'invalid' | 'unsubscribed') {
  return new URL(buildEmailWebUrl('/waitlist/unsubscribe', { status }))
}

export async function GET(request: NextRequest) {
  const email = request.nextUrl.searchParams.get('email')
  const token = request.nextUrl.searchParams.get('token')

  if (!(email && token)) {
    return NextResponse.redirect(buildRedirect('invalid'), { status: 303 })
  }

  if (!verifyWaitlistUnsubscribeToken({ email, token })) {
    return NextResponse.redirect(buildRedirect('invalid'), { status: 303 })
  }

  await unsubscribeWaitlistEntryByEmail(email)

  return NextResponse.redirect(buildRedirect('unsubscribed'), { status: 303 })
}
