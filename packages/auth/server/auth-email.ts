import 'server-only'

import { AuthSignInOtpEmail } from '@outname/email/auth-sign-in-otp-email'
import { getEmailLogoUrl } from '@outname/shared/server/email-logo-url'
import { getEmailAppLoginUrl } from '@outname/shared/server/email-urls'
import { sendResendReactEmail } from '@outname/shared/server/resend'
import { createElement } from 'react'

const AUTH_EMAIL_OTP_EXPIRES_IN_SECONDS = 60 * 10

function getAuthFromEmail(): string {
  const fromEmail = process.env.AUTH_FROM_EMAIL
  if (!fromEmail) {
    throw new Error('AUTH_FROM_EMAIL is not set')
  }
  return fromEmail
}

function getAuthReplyTo(): string {
  const replyTo = process.env.AUTH_REPLY_TO
  if (!replyTo) {
    throw new Error('AUTH_REPLY_TO is not set')
  }
  return replyTo
}

function createOtpIdempotencyKey(email: string, otp: string): string {
  return `auth-email-otp/${encodeURIComponent(email.toLowerCase())}/${otp}`
}

export async function sendAuthSignInOtpEmail(input: {
  email: string
  otp: string
}) {
  await sendResendReactEmail({
    from: getAuthFromEmail(),
    idempotencyKey: createOtpIdempotencyKey(input.email, input.otp),
    replyTo: getAuthReplyTo(),
    subject: 'Your OUTNA.ME sign-in code',
    to: input.email,
    react: createElement(AuthSignInOtpEmail, {
      code: input.otp,
      expiresInMinutes: AUTH_EMAIL_OTP_EXPIRES_IN_SECONDS / 60,
      loginUrl: getEmailAppLoginUrl(),
      logoUrl: getEmailLogoUrl(),
    }),
  })
}
