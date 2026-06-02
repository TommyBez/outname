import 'server-only'

import { ApplicationInviteEmail } from '@outname/email/application-invite-email'
import { WaitlistAdminSignupEmail } from '@outname/email/waitlist-admin-signup-email'
import { WaitlistConfirmationEmail } from '@outname/email/waitlist-confirmation-email'
import { WaitlistInviteEmail } from '@outname/email/waitlist-invite-email'
import { getEmailLogoUrl } from '@outname/shared/server/email-logo-url'
import {
  getEmailAppLoginUrl,
  getEmailWaitlistAdminUrl,
  getEmailWaitlistConfirmationUrl,
} from '@outname/shared/server/email-urls'
import { sendResendReactEmail } from '@outname/shared/server/resend'
import { siteConfig } from '@outname/shared/server/site-metadata'
import { getWaitlistAdminEmail } from '@outname/shared/waitlist/server/admin-email-config'
import {
  WAITLIST_PRIMARY_INTEREST_OPTIONS,
  WAITLIST_PROFILE_TYPE_OPTIONS,
  type WaitlistPrimaryInterest,
  type WaitlistProfileType,
} from '@outname/shared/waitlist/server/constants'
import { createElement, type ReactElement } from 'react'

function createWaitlistEmailIdempotencyKey(
  eventType:
    | 'application-invite'
    | 'waitlist-admin-signup'
    | 'waitlist-confirmation'
    | 'waitlist-invite',
  entityId: string
): string {
  return `${eventType}/${encodeURIComponent(entityId.toLowerCase())}`
}

function getWaitlistOptionLabel<T extends { label: string; value: string }>(
  options: readonly T[],
  value?: string | null
): string | null {
  if (!value) {
    return null
  }
  return options.find((option) => option.value === value)?.label ?? value
}

function getWaitlistFromEmail(): string {
  const fromEmail = process.env.WAITLIST_FROM_EMAIL
  if (!fromEmail) {
    throw new Error('WAITLIST_FROM_EMAIL is not set')
  }
  return fromEmail
}

function getWaitlistReplyTo(): string {
  const replyTo = process.env.WAITLIST_REPLY_TO
  if (!replyTo) {
    throw new Error('WAITLIST_REPLY_TO is not set')
  }
  return replyTo
}

async function sendResendEmail(input: {
  idempotencyKey: string
  react: ReactElement
  subject: string
  to: string
}) {
  await sendResendReactEmail({
    ...input,
    from: getWaitlistFromEmail(),
    replyTo: getWaitlistReplyTo(),
  })
}

export async function sendWaitlistConfirmationEmail(input: {
  email: string
  token: string
}) {
  const confirmationUrl = getEmailWaitlistConfirmationUrl(input.token)
  await sendResendEmail({
    idempotencyKey: createWaitlistEmailIdempotencyKey(
      'waitlist-confirmation',
      input.token
    ),
    to: input.email,
    subject: 'Confirm your OUTNA.ME waitlist request',
    react: createElement(WaitlistConfirmationEmail, {
      confirmationUrl,
      logoUrl: getEmailLogoUrl(),
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
      loginUrl: getEmailAppLoginUrl(),
      logoUrl: getEmailLogoUrl(),
    }),
  })
}

export async function sendApplicationInviteEmail(input: { email: string }) {
  await sendResendEmail({
    idempotencyKey: createWaitlistEmailIdempotencyKey(
      'application-invite',
      input.email
    ),
    to: input.email,
    subject: `You're invited to ${siteConfig.name}`,
    react: createElement(ApplicationInviteEmail, {
      loginUrl: getEmailAppLoginUrl(),
      logoUrl: getEmailLogoUrl(),
    }),
  })
}

export interface WaitlistAdminSignupNotificationInput {
  email: string
  entryId: string
  name?: string | null
  primaryInterest?: WaitlistPrimaryInterest | null
  profileType?: WaitlistProfileType | null
  source?: string | null
  useCase?: string | null
  utmCampaign?: string | null
  utmMedium?: string | null
  utmSource?: string | null
}

export async function sendWaitlistAdminSignupNotification(
  input: WaitlistAdminSignupNotificationInput
) {
  const adminEmail = getWaitlistAdminEmail()
  if (!adminEmail) {
    return
  }

  await sendResendEmail({
    idempotencyKey: createWaitlistEmailIdempotencyKey(
      'waitlist-admin-signup',
      input.entryId
    ),
    to: adminEmail,
    subject: `New waitlist signup: ${input.email}`,
    react: createElement(WaitlistAdminSignupEmail, {
      adminUrl: getEmailWaitlistAdminUrl(),
      email: input.email,
      logoUrl: getEmailLogoUrl(),
      name: input.name,
      primaryInterestLabel: getWaitlistOptionLabel(
        WAITLIST_PRIMARY_INTEREST_OPTIONS,
        input.primaryInterest
      ),
      profileTypeLabel: getWaitlistOptionLabel(
        WAITLIST_PROFILE_TYPE_OPTIONS,
        input.profileType
      ),
      source: input.source,
      useCase: input.useCase,
      utmCampaign: input.utmCampaign,
      utmMedium: input.utmMedium,
      utmSource: input.utmSource,
    }),
  })
}
