import { auth } from '@outname/auth/server/auth'
import { denyIfBot } from '@outname/shared/server/botid-guard'
import { toNextJsHandler } from 'better-auth/next-js'
import { NextResponse } from 'next/server'

const handler = toNextJsHandler(auth.handler)
const BUILT_IN_OTP_SEND_PATH = '/api/auth/email-otp/send-verification-otp'
const TRAILING_SLASH_PATTERN = /\/$/

function isBuiltInOtpSendRequest(req: Request): boolean {
  const pathname = new URL(req.url).pathname.replace(TRAILING_SLASH_PATTERN, '')
  return pathname === BUILT_IN_OTP_SEND_PATH
}

export async function POST(req: Request) {
  const botDenied = await denyIfBot(req)
  if (botDenied) {
    return botDenied
  }

  if (isBuiltInOtpSendRequest(req)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return handler.POST(req)
}

export const GET = handler.GET
