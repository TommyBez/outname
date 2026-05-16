import 'server-only'

import { createElement } from 'react'
import { AuthSignInOtpEmail } from '@/emails/auth-sign-in-otp-email'
import { sendResendReactEmail } from '@/shared/server/resend'
import { siteConfig } from '@/shared/server/site-metadata'

const AUTH_EMAIL_OTP_EXPIRES_IN_SECONDS = 60 * 10

function getBaseUrl(): string {
  return process.env.BETTER_AUTH_URL || siteConfig.url
}

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

function getEmailLogoUrl(): string {
  return `${getBaseUrl()}/email/outna-logo.png`
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
      loginUrl: `${getBaseUrl()}/login`,
      logoUrl: getEmailLogoUrl(),
    }),
  })
}
