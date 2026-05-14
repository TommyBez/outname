import 'server-only'

import { siteConfig } from '@/shared/server/site-metadata'

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

async function sendResendEmail(input: {
  html: string
  subject: string
  text: string
  to: string
}) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${getResendApiKey()}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      from: getWaitlistFromEmail(),
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
      reply_to: process.env.WAITLIST_REPLY_TO || undefined,
    }),
  })

  if (!response.ok) {
    throw new Error(`Resend email send failed with status ${response.status}`)
  }
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
    to: input.email,
    subject: 'Confirm your waitlist spot',
    text: `Confirm your waitlist spot by opening this link: ${confirmationUrl}`,
    html: `<p>Confirm your waitlist spot.</p><p><a href="${confirmationUrl}">Open confirmation page</a></p>`,
  })
}

export async function sendWaitlistInviteEmail(input: { email: string }) {
  const baseUrl = getBaseUrl()
  await sendResendEmail({
    to: input.email,
    subject: 'Your access is ready',
    text: `Your access is ready. Sign in here: ${baseUrl}/login`,
    html: `<p>Your access is ready.</p><p><a href="${baseUrl}/login">Sign in</a></p>`,
  })
}
