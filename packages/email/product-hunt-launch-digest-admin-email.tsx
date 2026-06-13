import { WaitlistEmailLayout } from '@outname/email/components/waitlist-email-layout'
import { EMAIL_BRAND_NAME } from '@outname/email/email-brand'
import { EMAIL_PREVIEW_URLS } from '@outname/email/email-preview-urls'
import { Text } from 'react-email'

export interface ProductHuntLaunchDigestMetric {
  label: string
  value: string
}

export interface ProductHuntLaunchDigestSection {
  label: string
  metrics: ProductHuntLaunchDigestMetric[]
}

export interface ProductHuntLaunchDigestAdminEmailProps {
  digestKey: string
  digestLabel: string
  launchPageUrl: string
  logoUrl: string
  productHuntUrl?: string | null
  runAtIso: string
  sections: ProductHuntLaunchDigestSection[]
}

function DetailRow({ label, value }: ProductHuntLaunchDigestMetric) {
  return (
    <Text className="m-0 mt-[10px] text-[14px] text-ink leading-[22px]">
      <span className="font-black uppercase tracking-[1px]">{label}: </span>
      {value}
    </Text>
  )
}

function DigestSection({
  section,
}: {
  section: ProductHuntLaunchDigestSection
}) {
  return (
    <>
      <Text className="m-0 mt-[22px] font-black text-[11px] text-signal uppercase tracking-[2px]">
        {section.label}
      </Text>
      {section.metrics.map((metric) => (
        <DetailRow key={`${section.label}:${metric.label}`} {...metric} />
      ))}
    </>
  )
}

export function ProductHuntLaunchDigestAdminEmail({
  digestKey,
  digestLabel,
  launchPageUrl,
  logoUrl,
  productHuntUrl,
  runAtIso,
  sections,
}: ProductHuntLaunchDigestAdminEmailProps) {
  return (
    <WaitlistEmailLayout
      ctaHref={productHuntUrl ?? launchPageUrl}
      ctaLabel={productHuntUrl ? 'Open Product Hunt' : 'Open launch page'}
      eyebrow={`${EMAIL_BRAND_NAME} / Product Hunt / digest`}
      footerEyebrow={`${EMAIL_BRAND_NAME} / internal`}
      footerText="Internal Product Hunt launch digest. Preview deployments suppress this email."
      lead="The launch automation collected a checkpoint summary so the launch can keep running without a manual operator."
      logoUrl={logoUrl}
      preview={`${EMAIL_BRAND_NAME} Product Hunt launch digest: ${digestLabel}`}
      title={digestLabel}
    >
      <DetailRow label="Digest" value={digestKey} />
      <DetailRow label="Run time" value={runAtIso} />
      {productHuntUrl ? (
        <DetailRow label="Product Hunt URL" value={productHuntUrl} />
      ) : (
        <DetailRow label="Product Hunt URL" value="Not resolved yet" />
      )}

      {sections.map((section) => (
        <DigestSection key={section.label} section={section} />
      ))}
    </WaitlistEmailLayout>
  )
}

ProductHuntLaunchDigestAdminEmail.PreviewProps = {
  digestKey: 'launch-day-evening',
  digestLabel: 'Launch day evening digest',
  launchPageUrl: EMAIL_PREVIEW_URLS.webProductHunt,
  logoUrl: EMAIL_PREVIEW_URLS.logo,
  productHuntUrl: 'https://www.producthunt.com/posts/outna-me',
  runAtIso: '2026-06-16T18:30:00.000Z',
  sections: [
    {
      label: 'Waitlist',
      metrics: [
        { label: 'Product Hunt signups', value: '18' },
        { label: 'Confirmed', value: '12' },
      ],
    },
    {
      label: 'Automation',
      metrics: [
        { label: 'Launch emails sent', value: '64' },
        { label: 'Typefully drafts recorded', value: '6' },
      ],
    },
  ],
} satisfies ProductHuntLaunchDigestAdminEmailProps

export default ProductHuntLaunchDigestAdminEmail
