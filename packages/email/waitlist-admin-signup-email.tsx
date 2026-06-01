import { WaitlistEmailLayout } from '@outname/email/components/waitlist-email-layout'
import { EMAIL_BRAND_NAME } from '@outname/email/email-brand'
import { Text } from 'react-email'

export interface WaitlistAdminSignupEmailProps {
  adminUrl: string
  email: string
  logoUrl: string
  name?: string | null
  primaryInterestLabel?: string | null
  profileTypeLabel?: string | null
  source?: string | null
  useCase?: string | null
  utmCampaign?: string | null
  utmMedium?: string | null
  utmSource?: string | null
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <Text className="m-0 mt-[10px] text-[14px] text-ink leading-[22px]">
      <span className="font-black uppercase tracking-[1px]">{label}: </span>
      {value}
    </Text>
  )
}

export function WaitlistAdminSignupEmail({
  adminUrl,
  email,
  logoUrl,
  name,
  primaryInterestLabel,
  profileTypeLabel,
  source,
  useCase,
  utmCampaign,
  utmMedium,
  utmSource,
}: WaitlistAdminSignupEmailProps) {
  const attribution = [utmSource, utmMedium, utmCampaign]
    .filter((value): value is string => Boolean(value))
    .join(' / ')

  return (
    <WaitlistEmailLayout
      ctaHref={adminUrl}
      ctaLabel="Open waitlist admin"
      eyebrow={`${EMAIL_BRAND_NAME} / waitlist / admin`}
      footerEyebrow={`${EMAIL_BRAND_NAME} / internal`}
      footerText="Internal notification for a new waitlist signup. The address still needs to confirm before the entry is marked confirmed."
      lead="A new address joined the waitlist and is waiting for email confirmation."
      logoUrl={logoUrl}
      preview={`New ${EMAIL_BRAND_NAME} waitlist signup: ${email}`}
      title="New waitlist signup"
    >
      <DetailRow label="Email" value={email} />
      {name ? <DetailRow label="Name" value={name} /> : null}
      {primaryInterestLabel ? (
        <DetailRow label="Interest" value={primaryInterestLabel} />
      ) : null}
      {profileTypeLabel ? (
        <DetailRow label="Profile" value={profileTypeLabel} />
      ) : null}
      {useCase ? <DetailRow label="Use case" value={useCase} /> : null}
      {source ? <DetailRow label="Source" value={source} /> : null}
      {attribution ? <DetailRow label="UTM" value={attribution} /> : null}
    </WaitlistEmailLayout>
  )
}

WaitlistAdminSignupEmail.PreviewProps = {
  adminUrl: 'https://app.outna.me/settings/waitlist',
  email: 'alex@example.com',
  logoUrl: '/static/outna-logo.png',
  name: 'Alex Rivera',
  primaryInterestLabel: 'Try early access',
  profileTypeLabel: 'Developer',
  source: 'landing',
  useCase: 'Need a repo-native agent workspace for OSS maintenance.',
  utmCampaign: 'launch',
  utmMedium: 'social',
  utmSource: 'linkedin',
} satisfies WaitlistAdminSignupEmailProps

export default WaitlistAdminSignupEmail
