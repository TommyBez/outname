import { Link, Text } from 'react-email'
import { WaitlistEmailLayout } from '@/emails/components/waitlist-email-layout'
import { EMAIL_BRAND_NAME } from '@/emails/email-brand'

const VERCEL_AI_GATEWAY_URL = 'https://vercel.com/d?to=%2F%5Bteam%5D%2F%7E%2Fai'

export interface WaitlistConfirmationEmailProps {
  confirmationUrl: string
  logoUrl: string
}

export function WaitlistConfirmationEmail({
  confirmationUrl,
  logoUrl,
}: WaitlistConfirmationEmailProps) {
  return (
    <WaitlistEmailLayout
      ctaHref={confirmationUrl}
      ctaLabel="Open confirmation page"
      eyebrow={`${EMAIL_BRAND_NAME} / waitlist`}
      lead="One last confirmation keeps the queue clean and makes sure we only email people who asked for access."
      logoUrl={logoUrl}
      preview={`Confirm your ${EMAIL_BRAND_NAME} waitlist request.`}
      title="Confirm your spot"
    >
      <Text className="m-0 text-[14px] text-ink leading-[22px]">
        You requested early access to {EMAIL_BRAND_NAME}. Confirm your email
        address to keep your place active and receive the invite when access is
        ready.
      </Text>
      <Text className="m-0 mt-[16px] text-[14px] text-subtle leading-[22px]">
        For safety, the link opens a confirmation page first. Your request is
        completed only after you press the confirmation button on that page.
      </Text>
      <Text className="m-0 mt-[16px] text-[14px] text-subtle leading-[22px]">
        You will also need your personal Vercel AI Gateway API key before you
        can run agents. Once your access is approved and you can sign in, add it
        in Settings / AI Gateway (BYOK).
      </Text>
      <Text className="m-0 mt-[16px] text-[12px] text-subtle leading-[20px]">
        Create the key here:{' '}
        <Link className="text-signal no-underline" href={VERCEL_AI_GATEWAY_URL}>
          Vercel AI Gateway dashboard
        </Link>
      </Text>
    </WaitlistEmailLayout>
  )
}

WaitlistConfirmationEmail.PreviewProps = {
  confirmationUrl: 'https://outna.me/waitlist/confirm?token=example-token',
  logoUrl: '/static/outna-logo.png',
} satisfies WaitlistConfirmationEmailProps

export default WaitlistConfirmationEmail
