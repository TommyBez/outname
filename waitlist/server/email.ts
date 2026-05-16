import 'server-only'

import { createElement, type ReactElement } from 'react'
import { WaitlistConfirmationEmail } from '@/emails/waitlist-confirmation-email'
import { WaitlistInviteEmail } from '@/emails/waitlist-invite-email'
import { sendTransactionalEmail } from '@/shared/server/resend'
import { siteConfig } from '@/shared/server/site-metadata'

function getBaseUrl(): string {
  return process.env.BETTER_AUTH_URL || siteConfig.url
}

function createWaitlistEmailIdempotencyKey(
  eventType: 'waitlist-confirmation' | 'waitlist-invite',
  entityId: string
): string {
  return `${eventType}/${encodeURIComponent(entityId.toLowerCase())}`
}

async function sendResendEmail(input: {
  idempotencyKey: string
  react: ReactElement
  subject: string
  to: string
}) {
  await sendTransactionalEmail(input)
}

function getWaitlistLogoUrl(): string {
  return `${getBaseUrl()}/email/outna-logo.png`
}

export function buildWaitlistConfirmationUrl(token: string): string {
  const url = new URL('/waitlist/confirm', getBaseUrl())
  url.searchParams.set('token', token)
  return url.toString()
}

export async function sendWaitlistConfirmationEmail(input: {
  email: string
  token: string
}) {
  const confirmationUrl = buildWaitlistConfirmationUrl(input.token)
  await sendResendEmail({
    idempotencyKey: createWaitlistEmailIdempotencyKey(
      'waitlist-confirmation',
      input.token
    ),
    to: input.email,
    subject: 'Confirm your OUTNA.ME waitlist request',
    react: createElement(WaitlistConfirmationEmail, {
      confirmationUrl,
      logoUrl: getWaitlistLogoUrl(),
    }),
  })
}

export async function sendWaitlistInviteEmail(input: { email: string }) {
  await sendResendEmail({
    idempotencyKey: createWaitlistEmailIdempotencyKey(
      'waitlist-invite',
      input.email
    ),
    to: input.email,
    subject: 'Your OUTNA.ME access is ready',
    react: createElement(WaitlistInviteEmail, {
      loginUrl: `${getBaseUrl()}/login`,
      logoUrl: getWaitlistLogoUrl(),
    }),
  })
}
