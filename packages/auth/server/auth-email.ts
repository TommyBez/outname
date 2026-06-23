import 'server-only'

import { AuthSignInOtpEmail } from '@outname/email/auth-sign-in-otp-email'
import { NewUserWelcomeEmail } from '@outname/email/new-user-welcome-email'
import { getEmailLogoUrl } from '@outname/shared/server/email-logo-url'
import {
  buildEmailAppUrl,
  getEmailAppLoginUrl,
} from '@outname/shared/server/email-urls'
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

function createWelcomeIdempotencyKey(userId: string): string {
  return `auth-new-user-welcome/${encodeURIComponent(userId)}`
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

export async function sendAuthNewUserWelcomeEmail(input: {
  email: string
  userId: string
}) {
  await sendResendReactEmail({
    from: getAuthFromEmail(),
    idempotencyKey: createWelcomeIdempotencyKey(input.userId),
    replyTo: getAuthReplyTo(),
    subject: 'Your OUTNA.ME account is ready',
    to: input.email,
    react: createElement(NewUserWelcomeEmail, {
      dashboardUrl: buildEmailAppUrl('/dashboard'),
      logoUrl: getEmailLogoUrl(),
    }),
  })
}
