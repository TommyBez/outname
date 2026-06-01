import { EMAIL_BRAND_NAME } from '@outname/email/email-brand'
import { waitlistEmailTailwind } from '@outname/email/waitlist-email-theme'
import { siteConfig } from '@outname/shared/server/site-metadata'
import type { ReactNode } from 'react'
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Tailwind,
  Text,
} from 'react-email'

interface WaitlistEmailLayoutProps {
  children: ReactNode
  ctaHref?: string
  ctaLabel?: string
  eyebrow: string
  footer?: ReactNode
  footerEyebrow?: string
  footerText?: string
  lead: string
  logoUrl: string
  preview: string
  title: string
}

export function WaitlistEmailLayout({
  children,
  ctaHref,
  ctaLabel,
  eyebrow,
  footerEyebrow,
  footerText,
  footer,
  lead,
  logoUrl,
  preview,
  title,
}: WaitlistEmailLayoutProps) {
  return (
    <Html lang="en">
      <Tailwind config={waitlistEmailTailwind}>
        <Head />
        <Body className="bg-canvas px-[12px] py-[24px] font-sans text-ink">
          <Preview>{preview}</Preview>
          <Container className="mx-auto my-0 border-2 border-ink border-solid bg-card">
            <Section className="px-[32px] py-[28px]">
              <Text className="m-0 font-black text-[11px] text-signal uppercase tracking-[2.4px]">
                {eyebrow}
              </Text>
              <Section className="mt-[18px]">
                <Link href={siteConfig.url}>
                  <Img
                    alt={`${siteConfig.name} logo`}
                    className="my-0"
                    height="56"
                    src={logoUrl}
                    width="56"
                  />
                </Link>
              </Section>
              <Heading className="m-0 mt-[18px] font-black text-[38px] text-ink uppercase leading-[36px] tracking-[-1.6px]">
                {title}
              </Heading>
              <Text className="m-0 mt-[18px] border-ink border-l-2 border-solid border-none pl-[12px] text-[14px] text-subtle leading-[22px]">
                {lead}
              </Text>
            </Section>

            <Hr className="mx-0 my-0 w-full border-ink border-t-2 border-solid border-none" />

            <Section className="px-[32px] py-[28px]">
              {children}

              {ctaHref && ctaLabel ? (
                <>
                  <Section className="mt-[28px]">
                    <Button
                      className="box-border inline-block border-2 border-ink border-solid bg-ink px-[20px] py-[14px] font-black text-[12px] text-card uppercase tracking-[1.8px] no-underline"
                      href={ctaHref}
                    >
                      {ctaLabel}
                    </Button>
                  </Section>
                  <Text className="m-0 mt-[16px] text-[12px] text-subtle leading-[20px]">
                    If the button does not work, copy and paste this URL into
                    your browser:{' '}
                    <Link className="text-signal no-underline" href={ctaHref}>
                      {ctaHref}
                    </Link>
                  </Text>
                </>
              ) : null}
            </Section>

            <Hr className="mx-0 my-0 w-full border-ink border-t-2 border-solid border-none" />

            <Section className="px-[32px] py-[20px]">
              {footer ?? (
                <>
                  <Text className="m-0 font-black text-[11px] text-subtle uppercase tracking-[2px]">
                    {footerEyebrow ?? `${EMAIL_BRAND_NAME} / waitlist`}
                  </Text>
                  {footerText ? (
                    <Text className="m-0 mt-[12px] text-[12px] text-subtle leading-[20px]">
                      {footerText}
                    </Text>
                  ) : (
                    <Text className="m-0 mt-[12px] text-[12px] text-subtle leading-[20px]">
                      This email was sent because an address requested access to{' '}
                      {EMAIL_BRAND_NAME}. If that was not you, you can safely
                      ignore it.
                    </Text>
                  )}
                  <Text className="m-0 mt-[10px] text-[12px] text-subtle leading-[20px]">
                    <Link
                      className="text-ink no-underline"
                      href={siteConfig.url}
                    >
                      {siteConfig.url}
                    </Link>
                  </Text>
                </>
              )}
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  )
}
