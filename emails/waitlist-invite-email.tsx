import { Link, Text } from 'react-email'
import { WaitlistEmailLayout } from '@/emails/components/waitlist-email-layout'
import { EMAIL_BRAND_NAME } from '@/emails/email-brand'

export interface WaitlistInviteEmailProps {
  loginUrl: string
  logoUrl: string
}

export function WaitlistInviteEmail({
  loginUrl,
  logoUrl,
}: WaitlistInviteEmailProps) {
  return (
    <WaitlistEmailLayout
      ctaHref={loginUrl}
      ctaLabel={`Sign in to ${EMAIL_BRAND_NAME}`}
      eyebrow={`${EMAIL_BRAND_NAME} / access`}
      lead="Your waitlist request has been approved. Sign in with the email address you confirmed to start working with your agent workspace."
      logoUrl={logoUrl}
      preview={`Your ${EMAIL_BRAND_NAME} access is ready.`}
      title="Access ready"
    >
      <Text className="m-0 text-[14px] text-ink leading-[22px]">
        Your access is now available. Open the login page and continue with the
        same email address used for the waitlist confirmation.
      </Text>
      <Text className="m-0 mt-[16px] text-[14px] text-subtle leading-[22px]">
        If you were not expecting this message, you can ignore it or reply to
        this email and we will help you sort it out.
      </Text>
      <Text className="m-0 mt-[16px] text-[12px] text-subtle leading-[20px]">
        Prefer a direct link?{' '}
        <Link className="text-signal no-underline" href={loginUrl}>
          {loginUrl}
        </Link>
      </Text>
    </WaitlistEmailLayout>
  )
}

WaitlistInviteEmail.PreviewProps = {
  loginUrl: 'https://outna.me/login',
  logoUrl: '/static/outna-logo.png',
} satisfies WaitlistInviteEmailProps

export default WaitlistInviteEmail
