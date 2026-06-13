import { WaitlistEmailLayout } from '@outname/email/components/waitlist-email-layout'
import { EMAIL_BRAND_NAME } from '@outname/email/email-brand'
import { EMAIL_PREVIEW_URLS } from '@outname/email/email-preview-urls'
import type { ProductHuntEmailEventKey } from '@outname/shared/launch/product-hunt'
import { PRODUCT_HUNT_LAUNCH } from '@outname/shared/launch/product-hunt'
import { Link, Text } from 'react-email'

export interface ProductHuntLaunchEmailProps {
  eventKey: ProductHuntEmailEventKey
  launchLandingUrl: string
  logoUrl: string
  productHuntUrl?: string | null
  unsubscribeUrl: string
}

const emailCopy: Record<
  ProductHuntEmailEventKey,
  {
    body: string[]
    ctaLabel: string
    lead: string
    preview: string
    title: string
  }
> = {
  'vercel-day-reminder': {
    body: [
      `${EMAIL_BRAND_NAME} is scheduled for Product Hunt on ${PRODUCT_HUNT_LAUNCH.launchDateLabel}, tagged for ${PRODUCT_HUNT_LAUNCH.productHuntTag}.`,
      'The angle is simple: hosted personal AI agents that keep working, built on Vercel Sandbox, Workflow, AI SDK, and Chat SDK.',
      'If you want to help, the useful thing is honest feedback once the page is live. No upvote asks, no pressure.',
    ],
    ctaLabel: 'Open launch landing page',
    lead: `Launch is scheduled for ${PRODUCT_HUNT_LAUNCH.pacificLaunchTimeLabel} (${PRODUCT_HUNT_LAUNCH.localLaunchTimeLabel}).`,
    preview: `${EMAIL_BRAND_NAME} launches for Vercel Day on Product Hunt this Tuesday.`,
    title: 'Vercel Day launch is scheduled',
  },
  'vercel-day-live': {
    body: [
      `${EMAIL_BRAND_NAME} is live on Product Hunt for ${PRODUCT_HUNT_LAUNCH.productHuntTag}.`,
      'The launch page explains the product and the Vercel-native runtime behind it: Sandbox for isolated agent work, Workflow for durable runs, AI SDK for model/tool work, and Chat SDK for product surfaces.',
      'If you have a minute, leave an honest comment or question on Product Hunt. Specific feedback helps more than generic support.',
    ],
    ctaLabel: 'Open Product Hunt launch',
    lead: 'The launch is live. Feedback and questions matter most today.',
    preview: `${EMAIL_BRAND_NAME} is live on Product Hunt for Vercel Day.`,
    title: 'We are live on Product Hunt',
  },
  'vercel-day-live-fallback': {
    body: [
      `${EMAIL_BRAND_NAME}'s Vercel Day launch page is live.`,
      'The Product Hunt URL was not available when this automation ran, so this fallback points to the launch page instead of sending a placeholder link.',
      'The useful ask is still feedback: what is clear, what is confusing, and what first autonomous agent would you actually trust?',
    ],
    ctaLabel: 'Open launch page',
    lead: 'The Vercel Day launch page is live and collecting feedback.',
    preview: `${EMAIL_BRAND_NAME}'s Vercel Day launch page is live.`,
    title: 'Vercel Day launch page is live',
  },
  'vercel-day-recap': {
    body: [
      `Thanks for following the ${EMAIL_BRAND_NAME} Product Hunt launch.`,
      'The best next step is still practical feedback: what is clear, what is confusing, and what you would want an autonomous personal agent to do first.',
      'I will use the launch comments to tighten onboarding, docs, and the first early-access batch.',
    ],
    ctaLabel: 'Read the launch thread',
    lead: 'Launch day is over; the feedback loop is still open.',
    preview: `A short ${EMAIL_BRAND_NAME} Product Hunt launch follow-up.`,
    title: 'Product Hunt follow-up',
  },
  'vercel-day-recap-fallback': {
    body: [
      `Thanks for following the ${EMAIL_BRAND_NAME} Vercel Day launch.`,
      'The Product Hunt URL was not available to the launch automation, so this follow-up keeps the feedback loop on the launch page.',
      'The most useful feedback is practical: what should run without asking, what should wait for approval, and what first agent is narrow enough to trust?',
    ],
    ctaLabel: 'Open launch page',
    lead: 'The feedback loop is still open.',
    preview: `A short ${EMAIL_BRAND_NAME} Vercel Day launch follow-up.`,
    title: 'Vercel Day launch follow-up',
  },
}

export function ProductHuntLaunchEmail({
  eventKey,
  launchLandingUrl,
  logoUrl,
  productHuntUrl,
  unsubscribeUrl,
}: ProductHuntLaunchEmailProps) {
  const copy = emailCopy[eventKey]
  const ctaHref = productHuntUrl ?? launchLandingUrl

  return (
    <WaitlistEmailLayout
      ctaHref={ctaHref}
      ctaLabel={copy.ctaLabel}
      eyebrow={`${EMAIL_BRAND_NAME} / ${PRODUCT_HUNT_LAUNCH.productHuntTag}`}
      footer={
        <>
          <Text className="m-0 font-black text-[11px] text-subtle uppercase tracking-[2px]">
            {EMAIL_BRAND_NAME} / launch updates
          </Text>
          <Text className="m-0 mt-[12px] text-[12px] text-subtle leading-[20px]">
            You are receiving this because you joined the {EMAIL_BRAND_NAME}{' '}
            waitlist and confirmed your email.{' '}
            <Link className="text-ink no-underline" href={unsubscribeUrl}>
              Unsubscribe from waitlist updates
            </Link>
            .
          </Text>
        </>
      }
      lead={copy.lead}
      logoUrl={logoUrl}
      preview={copy.preview}
      title={copy.title}
    >
      {copy.body.map((paragraph) => (
        <Text
          className="m-0 mt-[16px] text-[14px] text-ink leading-[22px]"
          key={paragraph}
        >
          {paragraph}
        </Text>
      ))}
    </WaitlistEmailLayout>
  )
}

ProductHuntLaunchEmail.PreviewProps = {
  eventKey: 'vercel-day-live',
  launchLandingUrl: 'https://outna.me/product-hunt',
  logoUrl: EMAIL_PREVIEW_URLS.logo,
  productHuntUrl: 'https://www.producthunt.com/posts/outna-me',
  unsubscribeUrl: 'https://outna.me/waitlist/unsubscribe?status=preview',
} satisfies ProductHuntLaunchEmailProps

export default ProductHuntLaunchEmail
