import 'server-only'

import { ApplicationInviteEmail } from '@outname/email/application-invite-email'
import { ProductHuntFeedbackAdminEmail } from '@outname/email/product-hunt-feedback-admin-email'
import { ProductHuntLaunchEmail } from '@outname/email/product-hunt-launch-email'
import {
  ProductHuntLaunchIssueAdminEmail,
  type ProductHuntLaunchIssueAdminEmailIssue,
} from '@outname/email/product-hunt-launch-issue-admin-email'
import { WaitlistAdminSignupEmail } from '@outname/email/waitlist-admin-signup-email'
import { WaitlistConfirmationEmail } from '@outname/email/waitlist-confirmation-email'
import { WaitlistInviteEmail } from '@outname/email/waitlist-invite-email'
import type { ProductHuntEmailEventKey } from '@outname/shared/launch/product-hunt'
import { areProductHuntLaunchExternalSideEffectsDisabled } from '@outname/shared/launch/product-hunt-preview-safety'
import { getEmailLogoUrl } from '@outname/shared/server/email-logo-url'
import {
  buildEmailWebUrl,
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
import { createWaitlistUnsubscribeToken } from '@outname/shared/waitlist/server/preference-token'
import { createElement, type ReactElement } from 'react'

function createWaitlistEmailIdempotencyKey(
  eventType:
    | 'application-invite'
    | 'product-hunt-feedback-admin'
    | 'product-hunt-launch-issue'
    | 'product-hunt-launch'
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

type ProductHuntFeedbackType =
  | 'first-agent'
  | 'other'
  | 'positioning'
  | 'trust'
  | 'vercel-stack'

const PRODUCT_HUNT_FEEDBACK_TYPE_LABELS = {
  'first-agent': 'First agent',
  other: 'Other',
  positioning: 'Positioning',
  trust: 'Trust',
  'vercel-stack': 'Vercel stack',
} as const satisfies Record<ProductHuntFeedbackType, string>

function getProductHuntFeedbackTypeLabel(
  feedbackType: ProductHuntFeedbackType
): string {
  return PRODUCT_HUNT_FEEDBACK_TYPE_LABELS[feedbackType]
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
  return await sendResendReactEmail({
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

export interface ProductHuntFeedbackAdminNotificationInput {
  email?: string | null
  feedbackId: string
  feedbackType: ProductHuntFeedbackType
  message: string
  referrer?: string | null
  source?: string | null
  utmCampaign?: string | null
  utmContent?: string | null
  utmMedium?: string | null
  utmSource?: string | null
}

export async function sendProductHuntFeedbackAdminNotification(
  input: ProductHuntFeedbackAdminNotificationInput
) {
  const adminEmail = getWaitlistAdminEmail()
  if (!adminEmail) {
    return
  }

  const feedbackTypeLabel = getProductHuntFeedbackTypeLabel(input.feedbackType)

  await sendResendEmail({
    idempotencyKey: createWaitlistEmailIdempotencyKey(
      'product-hunt-feedback-admin',
      input.feedbackId
    ),
    to: adminEmail,
    subject: `Product Hunt feedback: ${feedbackTypeLabel}`,
    react: createElement(ProductHuntFeedbackAdminEmail, {
      email: input.email,
      feedbackId: input.feedbackId,
      feedbackTypeLabel,
      launchPageUrl: buildEmailWebUrl('/product-hunt#launch-feedback'),
      logoUrl: getEmailLogoUrl(),
      message: input.message,
      referrer: input.referrer,
      source: input.source,
      utmCampaign: input.utmCampaign,
      utmContent: input.utmContent,
      utmMedium: input.utmMedium,
      utmSource: input.utmSource,
    }),
  })
}

export async function sendProductHuntLaunchIssueAdminNotification(input: {
  dedupeKey: string
  issues: ProductHuntLaunchIssueAdminEmailIssue[]
  runAtIso: string
}) {
  if (areProductHuntLaunchExternalSideEffectsDisabled()) {
    return
  }

  const adminEmail = getWaitlistAdminEmail()
  if (!(adminEmail && input.issues.length > 0)) {
    return
  }

  await sendResendEmail({
    idempotencyKey: createWaitlistEmailIdempotencyKey(
      'product-hunt-launch-issue',
      input.dedupeKey
    ),
    to: adminEmail,
    subject: `Product Hunt launch issue: ${input.issues.length} check(s) need attention`,
    react: createElement(ProductHuntLaunchIssueAdminEmail, {
      issues: input.issues,
      launchPageUrl: buildEmailWebUrl('/product-hunt'),
      logoUrl: getEmailLogoUrl(),
      runAtIso: input.runAtIso,
    }),
  })
}

function getWaitlistUnsubscribeUrl(email: string): string {
  return buildEmailWebUrl('/api/waitlist/unsubscribe', {
    email,
    token: createWaitlistUnsubscribeToken(email),
  })
}

function getProductHuntLaunchEmailSubject(
  eventKey: ProductHuntEmailEventKey
): string {
  switch (eventKey) {
    case 'vercel-day-live':
      return 'OUTNA.ME is live on Product Hunt'
    case 'vercel-day-live-fallback':
      return 'OUTNA.ME Vercel Day launch page is live'
    case 'vercel-day-recap':
      return 'OUTNA.ME Product Hunt launch follow-up'
    case 'vercel-day-recap-fallback':
      return 'OUTNA.ME Vercel Day launch follow-up'
    case 'vercel-day-reminder':
      return 'OUTNA.ME launches on Product Hunt this Tuesday'
    default:
      return 'OUTNA.ME Product Hunt launch update'
  }
}

export async function sendProductHuntLaunchEmail(input: {
  email: string
  eventKey: ProductHuntEmailEventKey
  launchLandingUrl: string
  productHuntUrl?: string | null
}) {
  return await sendResendEmail({
    idempotencyKey: createWaitlistEmailIdempotencyKey(
      'product-hunt-launch',
      `${input.eventKey}:${input.email}`
    ),
    to: input.email,
    subject: getProductHuntLaunchEmailSubject(input.eventKey),
    react: createElement(ProductHuntLaunchEmail, {
      eventKey: input.eventKey,
      launchLandingUrl: input.launchLandingUrl,
      logoUrl: getEmailLogoUrl(),
      productHuntUrl: input.productHuntUrl,
      unsubscribeUrl: getWaitlistUnsubscribeUrl(input.email),
    }),
  })
}
