import { type NextRequest, NextResponse } from 'next/server'
import { consumeWaitlistConfirmationToken } from '@/waitlist/server/service'

function buildRedirect(request: NextRequest, search: string) {
  return new URL(`/waitlist/confirm${search}`, request.url)
}

export async function POST(request: NextRequest) {
  const formData = await request.formData()
  const rawToken = formData.get('token')
  if (typeof rawToken !== 'string' || rawToken.trim().length === 0) {
    return NextResponse.redirect(buildRedirect(request, ''), { status: 303 })
  }

  try {
    const confirmed = await consumeWaitlistConfirmationToken(rawToken)
    if (!confirmed) {
      return NextResponse.redirect(buildRedirect(request, ''), { status: 303 })
    }
    return NextResponse.redirect(buildRedirect(request, '?status=confirmed'), {
      status: 303,
    })
  } catch (error) {
    console.error('[waitlist] confirmation consume failed', error)
    return NextResponse.redirect(buildRedirect(request, ''), { status: 303 })
  }
}
