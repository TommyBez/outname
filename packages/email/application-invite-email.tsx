import { InferenceProviderSetupNote } from '@outname/email/components/inference-provider-setup-note'
import { WaitlistEmailLayout } from '@outname/email/components/waitlist-email-layout'
import { EMAIL_BRAND_NAME } from '@outname/email/email-brand'
import { EMAIL_PREVIEW_URLS } from '@outname/email/email-preview-urls'
import { siteConfig } from '@outname/shared/server/site-metadata'
import { Text } from 'react-email'

export interface ApplicationInviteEmailProps {
  loginUrl: string
  logoUrl: string
}

export function ApplicationInviteEmail({
  loginUrl,
  logoUrl,
}: ApplicationInviteEmailProps) {
  return (
    <WaitlistEmailLayout
      ctaHref={loginUrl}
      ctaLabel={`Open ${EMAIL_BRAND_NAME}`}
      eyebrow={`${EMAIL_BRAND_NAME} / invitation`}
      footerEyebrow={`${EMAIL_BRAND_NAME} / invitation`}
      footerText={`You received this email because someone invited you to try ${EMAIL_BRAND_NAME}. If that was not you, you can safely ignore it.`}
      lead={siteConfig.shortDescription}
      logoUrl={logoUrl}
      preview={`You're invited to ${EMAIL_BRAND_NAME}.`}
      title="You're invited"
    >
      <Text className="m-0 text-[14px] text-ink leading-[22px]">
        {EMAIL_BRAND_NAME} is for work that should not stall when you step away:
        follow-ups, research threads, recurring checks, and small tasks that
        need continuity more than a one-off answer.
      </Text>
      <Text className="m-0 mt-[16px] text-[14px] text-ink leading-[22px]">
        You set up personal agents with memory, schedules, and tools. They keep
        context between runs, can call other agents when useful, and return with
        clear updates instead of making you restart from scratch.
      </Text>
      <Text className="m-0 mt-[16px] text-[14px] text-subtle leading-[22px]">
        Your account is ready. Use the button below, enter this email address,
        and we will send you a one-time sign-in code.
      </Text>
      <InferenceProviderSetupNote />
      <Text className="m-0 mt-[16px] text-[14px] text-subtle leading-[22px]">
        If you were not expecting this invitation, ignore the message or reply
        to this email and we will help.
      </Text>
    </WaitlistEmailLayout>
  )
}

ApplicationInviteEmail.PreviewProps = {
  loginUrl: EMAIL_PREVIEW_URLS.appLogin,
  logoUrl: EMAIL_PREVIEW_URLS.logo,
} satisfies ApplicationInviteEmailProps

export default ApplicationInviteEmail
