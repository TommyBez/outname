import 'server-only'

import { createElement, type ReactElement } from 'react'
import { Resend } from 'resend'
import { WaitlistConfirmationEmail } from '@/emails/waitlist-confirmation-email'
import { WaitlistInviteEmail } from '@/emails/waitlist-invite-email'
import { siteConfig } from '@/shared/server/site-metadata'

let resendClient: Resend | null = null

function getBaseUrl(): string {
  return process.env.BETTER_AUTH_URL || siteConfig.url
}

function getWaitlistFromEmail(): string {
  const fromEmail = process.env.WAITLIST_FROM_EMAIL
  if (!fromEmail) {
    throw new Error('WAITLIST_FROM_EMAIL is not set')
  }
  return fromEmail
}

function getResendApiKey(): string {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not set')
  }
  return apiKey
}

function getResendClient(): Resend {
  if (resendClient) {
    return resendClient
  }

  resendClient = new Resend(getResendApiKey())
  return resendClient
}

function getWaitlistReplyTo(): string | undefined {
  return process.env.WAITLIST_REPLY_TO || undefined
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
  const { error } = await getResendClient().emails.send(
    {
      from: getWaitlistFromEmail(),
      replyTo: getWaitlistReplyTo(),
      subject: input.subject,
      to: [input.to],
      react: input.react,
    },
    {
      idempotencyKey: input.idempotencyKey,
    }
  )

  if (error) {
    const statusCodeSuffix = error.statusCode ? ` (${error.statusCode})` : ''
    throw new Error(
      `Resend email send failed [${error.name}]${statusCodeSuffix}: ${error.message}`
    )
  }
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
