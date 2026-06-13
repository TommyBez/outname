import { WaitlistEmailLayout } from '@outname/email/components/waitlist-email-layout'
import { EMAIL_BRAND_NAME } from '@outname/email/email-brand'
import { EMAIL_PREVIEW_URLS } from '@outname/email/email-preview-urls'
import { Text } from 'react-email'

export type ProductHuntLaunchIssueSeverity = 'failure' | 'warning'

export interface ProductHuntLaunchIssueAdminEmailIssue {
  details?: string[]
  key: string
  message: string
  severity: ProductHuntLaunchIssueSeverity
}

export interface ProductHuntLaunchIssueAdminEmailProps {
  issues: ProductHuntLaunchIssueAdminEmailIssue[]
  launchPageUrl: string
  logoUrl: string
  runAtIso: string
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <Text className="m-0 mt-[10px] text-[14px] text-ink leading-[22px]">
      <span className="font-black uppercase tracking-[1px]">{label}: </span>
      {value}
    </Text>
  )
}

function IssueBlock({
  issue,
}: {
  issue: ProductHuntLaunchIssueAdminEmailIssue
}) {
  return (
    <>
      <Text className="m-0 mt-[22px] font-black text-[11px] text-signal uppercase tracking-[2px]">
        {issue.severity} / {issue.key}
      </Text>
      <Text className="m-0 mt-[8px] text-[14px] text-ink leading-[22px]">
        {issue.message}
      </Text>
      {issue.details?.map((detail) => (
        <Text
          className="m-0 mt-[6px] border-ink border-l-2 border-solid border-none pl-[10px] text-[13px] text-subtle leading-[20px]"
          key={detail}
        >
          {detail}
        </Text>
      ))}
    </>
  )
}

export function ProductHuntLaunchIssueAdminEmail({
  issues,
  launchPageUrl,
  logoUrl,
  runAtIso,
}: ProductHuntLaunchIssueAdminEmailProps) {
  const failureCount = issues.filter(
    (issue) => issue.severity === 'failure'
  ).length

  return (
    <WaitlistEmailLayout
      ctaHref={launchPageUrl}
      ctaLabel="Open launch page"
      eyebrow={`${EMAIL_BRAND_NAME} / Product Hunt / operations`}
      footerEyebrow={`${EMAIL_BRAND_NAME} / internal`}
      footerText="Internal Product Hunt launch operations notification. Preview deployments suppress this email."
      lead="The Product Hunt launch cron completed with one or more operational issues that may need attention."
      logoUrl={logoUrl}
      preview={`${EMAIL_BRAND_NAME} Product Hunt launch issue: ${issues.length} check(s) need attention`}
      title="Launch issue"
    >
      <DetailRow label="Run time" value={runAtIso} />
      <DetailRow label="Issues" value={String(issues.length)} />
      <DetailRow label="Failures" value={String(failureCount)} />

      {issues.map((issue) => (
        <IssueBlock issue={issue} key={issue.key} />
      ))}
    </WaitlistEmailLayout>
  )
}

ProductHuntLaunchIssueAdminEmail.PreviewProps = {
  issues: [
    {
      details: ['typefully_request_failed: 2026-06-16-live-now-x'],
      key: 'product_hunt_social_posts',
      message:
        'Product Hunt social automation skipped posts for alertable reasons.',
      severity: 'failure',
    },
    {
      details: ['vercel-day-live failed for 3 recipient(s).'],
      key: 'product_hunt_email_delivery',
      message: 'Product Hunt email automation reported recipient failures.',
      severity: 'warning',
    },
  ],
  launchPageUrl: EMAIL_PREVIEW_URLS.webProductHunt,
  logoUrl: EMAIL_PREVIEW_URLS.logo,
  runAtIso: '2026-06-16T09:20:00.000Z',
} satisfies ProductHuntLaunchIssueAdminEmailProps

export default ProductHuntLaunchIssueAdminEmail
