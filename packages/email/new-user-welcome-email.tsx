import { InferenceProviderSetupNote } from '@outname/email/components/inference-provider-setup-note'
import { TransactionalEmailLayout } from '@outname/email/components/transactional-email-layout'
import { EMAIL_BRAND_NAME } from '@outname/email/email-brand'
import { EMAIL_PREVIEW_URLS } from '@outname/email/email-preview-urls'
import { siteConfig } from '@outname/shared/server/site-metadata'
import { Text } from 'react-email'

export interface NewUserWelcomeEmailProps {
  dashboardUrl: string
  logoUrl: string
}

export function NewUserWelcomeEmail({
  dashboardUrl,
  logoUrl,
}: NewUserWelcomeEmailProps) {
  return (
    <TransactionalEmailLayout
      ctaHref={dashboardUrl}
      ctaLabel={`Open ${EMAIL_BRAND_NAME}`}
      eyebrow={`${EMAIL_BRAND_NAME} / welcome`}
      footerEyebrow={`${EMAIL_BRAND_NAME} / account`}
      footerText={`You received this email because an account was created for ${EMAIL_BRAND_NAME}. If this was not you, reply to this email and we will help.`}
      lead={siteConfig.shortDescription}
      logoUrl={logoUrl}
      preview={`Your ${EMAIL_BRAND_NAME} account is ready.`}
      title="Your account is ready"
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
        Open the dashboard, add an inference provider key, and create your first
        agent when you are ready.
      </Text>
      <InferenceProviderSetupNote />
    </TransactionalEmailLayout>
  )
}

NewUserWelcomeEmail.PreviewProps = {
  dashboardUrl: 'https://app.outna.me/dashboard',
  logoUrl: EMAIL_PREVIEW_URLS.logo,
} satisfies NewUserWelcomeEmailProps

export default NewUserWelcomeEmail
