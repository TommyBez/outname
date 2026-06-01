import { WaitlistEmailLayout } from '@outname/email/components/waitlist-email-layout'
import { EMAIL_BRAND_NAME } from '@outname/email/email-brand'
import { Link, Section, Text } from 'react-email'

export interface AuthSignInOtpEmailProps {
  code: string
  expiresInMinutes: number
  loginUrl: string
  logoUrl: string
}

export function AuthSignInOtpEmail({
  code,
  expiresInMinutes,
  loginUrl,
  logoUrl,
}: AuthSignInOtpEmailProps) {
  return (
    <WaitlistEmailLayout
      ctaHref={loginUrl}
      ctaLabel={`Open ${EMAIL_BRAND_NAME}`}
      eyebrow={`${EMAIL_BRAND_NAME} / sign in`}
      footerEyebrow={`${EMAIL_BRAND_NAME} / security`}
      footerText={`You are receiving this message because someone requested a sign-in code for ${EMAIL_BRAND_NAME}. If this was not you, ignore this email and no access will be granted.`}
      lead={`Use this one-time code to finish signing in. It expires in ${expiresInMinutes} minutes and can only be used once.`}
      logoUrl={logoUrl}
      preview={`Your ${EMAIL_BRAND_NAME} sign-in code is ${code}.`}
      title="Your sign-in code"
    >
      <Text className="m-0 text-[14px] text-ink leading-[22px]">
        Enter the code below on the sign-in screen. Request a new one if it
        expires before you use it.
      </Text>

      <Section className="mt-[20px] border-2 border-ink border-solid bg-canvas px-[20px] py-[18px] text-center">
        <Text className="m-0 font-black font-mono text-[32px] text-ink tracking-[8px]">
          {code}
        </Text>
      </Section>

      <Text className="m-0 mt-[16px] text-[12px] text-subtle leading-[20px]">
        Want to switch devices? Open{' '}
        <Link className="text-signal no-underline" href={loginUrl}>
          {loginUrl}
        </Link>{' '}
        and request a fresh code there.
      </Text>
    </WaitlistEmailLayout>
  )
}

AuthSignInOtpEmail.PreviewProps = {
  code: '483921',
  expiresInMinutes: 10,
  loginUrl: 'https://outna.me/login',
  logoUrl: '/static/outna-logo.png',
} satisfies AuthSignInOtpEmailProps

export default AuthSignInOtpEmail
