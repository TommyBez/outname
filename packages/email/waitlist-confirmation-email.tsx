import { WaitlistEmailLayout } from '@outname/email/components/waitlist-email-layout'
import { EMAIL_BRAND_NAME } from '@outname/email/email-brand'
import { EMAIL_PREVIEW_URLS } from '@outname/email/email-preview-urls'
import { Text } from 'react-email'

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
    </WaitlistEmailLayout>
  )
}

WaitlistConfirmationEmail.PreviewProps = {
  confirmationUrl: EMAIL_PREVIEW_URLS.webWaitlistConfirm,
  logoUrl: EMAIL_PREVIEW_URLS.logo,
} satisfies WaitlistConfirmationEmailProps

export default WaitlistConfirmationEmail
