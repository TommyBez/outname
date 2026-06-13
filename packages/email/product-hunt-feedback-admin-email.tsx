import { WaitlistEmailLayout } from '@outname/email/components/waitlist-email-layout'
import { EMAIL_BRAND_NAME } from '@outname/email/email-brand'
import { EMAIL_PREVIEW_URLS } from '@outname/email/email-preview-urls'
import { Text } from 'react-email'

const MESSAGE_PARAGRAPH_SEPARATOR = /\n{2,}/

export interface ProductHuntFeedbackAdminEmailProps {
  email?: string | null
  feedbackId: string
  feedbackTypeLabel: string
  launchPageUrl: string
  logoUrl: string
  message: string
  referrer?: string | null
  source?: string | null
  utmCampaign?: string | null
  utmContent?: string | null
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

export function ProductHuntFeedbackAdminEmail({
  email,
  feedbackId,
  feedbackTypeLabel,
  launchPageUrl,
  logoUrl,
  message,
  referrer,
  source,
  utmCampaign,
  utmContent,
  utmMedium,
  utmSource,
}: ProductHuntFeedbackAdminEmailProps) {
  const attribution = [utmSource, utmMedium, utmCampaign, utmContent]
    .filter((value): value is string => Boolean(value))
    .join(' / ')
  const messageParagraphs = message
    .split(MESSAGE_PARAGRAPH_SEPARATOR)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0)

  return (
    <WaitlistEmailLayout
      ctaHref={launchPageUrl}
      ctaLabel="Open launch page"
      eyebrow={`${EMAIL_BRAND_NAME} / Product Hunt / feedback`}
      footerEyebrow={`${EMAIL_BRAND_NAME} / internal`}
      footerText="Internal Product Hunt launch feedback notification. The feedback is also stored in the launch_feedback table."
      lead="A visitor submitted Product Hunt launch feedback from the fallback launch page."
      logoUrl={logoUrl}
      preview={`New ${EMAIL_BRAND_NAME} Product Hunt feedback: ${feedbackTypeLabel}`}
      title="New launch feedback"
    >
      <DetailRow label="Type" value={feedbackTypeLabel} />
      <DetailRow label="Feedback ID" value={feedbackId} />
      {email ? <DetailRow label="Email" value={email} /> : null}
      {source ? <DetailRow label="Source" value={source} /> : null}
      {referrer ? <DetailRow label="Referrer" value={referrer} /> : null}
      {attribution ? <DetailRow label="UTM" value={attribution} /> : null}

      <Text className="m-0 mt-[22px] font-black text-[11px] text-signal uppercase tracking-[2px]">
        Message
      </Text>
      {messageParagraphs.map((paragraph) => (
        <Text
          className="m-0 mt-[10px] text-[14px] text-ink leading-[22px]"
          key={paragraph}
        >
          {paragraph}
        </Text>
      ))}
    </WaitlistEmailLayout>
  )
}

ProductHuntFeedbackAdminEmail.PreviewProps = {
  email: 'alex@example.com',
  feedbackId: 'lfbk_preview123',
  feedbackTypeLabel: 'First agent',
  launchPageUrl: EMAIL_PREVIEW_URLS.webProductHunt,
  logoUrl: EMAIL_PREVIEW_URLS.logo,
  message:
    'The first agent I would trust is a personal launch operator that drafts replies, keeps campaign state current, and asks before publishing anything sensitive.',
  referrer: 'https://www.producthunt.com/posts/outna-me',
  source: 'product-hunt-feedback',
  utmCampaign: 'vercel-day',
  utmContent: 'launch-page',
  utmMedium: 'social',
  utmSource: 'product-hunt',
} satisfies ProductHuntFeedbackAdminEmailProps

export default ProductHuntFeedbackAdminEmail
