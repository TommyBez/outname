import { getAppLoginUrl } from '@outname/shared/app-url'
import { LegalLink } from '@outname/shared/marketing/components/legal/legal-link'
import { LegalList } from '@outname/shared/marketing/components/legal/legal-list'
import { LegalSection } from '@outname/shared/marketing/components/legal/legal-section'
import { MarketingLegalLayout } from '@outname/shared/marketing/components/legal/marketing-legal-layout'
import {
  privacyEmail,
  supportEmail,
} from '@outname/shared/marketing/data/contact'
import { githubRepositoryUrl } from '@outname/shared/marketing/data/social-links'
import { siteConfig } from '@outname/shared/server/site-metadata'
import { isWaitlistPublicEnabled } from '@outname/shared/waitlist/server/public-config'
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Support',
  description: `Get help with ${siteConfig.name}, account access, agents, integrations, and more.`,
  alternates: {
    canonical: '/support',
  },
}

export default function SupportPage() {
  const waitlistEnabled = isWaitlistPublicEnabled()

  return (
    <MarketingLegalLayout>
      <header className="mb-12 border-border border-t-4 pt-6 md:mb-16">
        <p className="swiss-label mb-4 text-brand">Help</p>
        <h1 className="font-black font-serif text-5xl uppercase leading-[0.86] tracking-tighter sm:text-6xl">
          Support
        </h1>
        <p className="mt-6 max-w-xl border-border border-l pl-4 text-muted-foreground text-sm leading-relaxed">
          {siteConfig.name} is in early access. If something is broken or
          unclear, reach out, we read every message.
        </p>
      </header>

      <div className="mb-10 border border-border bg-muted/30 p-6 md:p-8">
        <p className="swiss-label text-brand">Primary contact</p>
        <p className="mt-4 font-black font-serif text-3xl uppercase leading-none tracking-tighter">
          <LegalLink href={`mailto:${supportEmail}`}>{supportEmail}</LegalLink>
        </p>
        <p className="mt-4 text-muted-foreground text-sm leading-relaxed">
          Include your account email, what you were trying to do, and any error
          messages or screenshots. We typically reply within a few business
          days.
        </p>
      </div>

      <div className="space-y-10">
        <LegalSection title="Account and access">
          <LegalList>
            <li>
              <strong className="text-foreground">Sign in</strong>, use email
              OTP at{' '}
              <LegalLink href={getAppLoginUrl('/dashboard')}>/login</LegalLink>.
              Codes expire quickly; request a new one if needed.
            </li>
            {waitlistEnabled ? (
              <li>
                <strong className="text-foreground">Waitlist</strong>, no
                account yet? Join at{' '}
                <LegalLink href="/waitlist?source=support-page">
                  /waitlist
                </LegalLink>{' '}
                and confirm via the email link we send.
              </li>
            ) : null}
            <li>
              <strong className="text-foreground">No access</strong>, sign-up is
              invite-only. If you were provisioned from the waitlist, use the
              same email you registered with.
            </li>
          </LegalList>
        </LegalSection>

        <LegalSection title="Agents and runs">
          <LegalList>
            <li>
              Scheduled or heartbeat runs not firing, check agent schedule,
              timezone, and whether the agent is paused.
            </li>
            <li>
              Tool or connection errors, reconnect the integration under{' '}
              <LegalLink href="/connections">Connections</LegalLink> and verify
              scopes match what the tool needs.
            </li>
            <li>
              Unexpected agent output, share the conversation ID, agent ID, and
              approximate time so we can trace the run.
            </li>
          </LegalList>
        </LegalSection>

        <LegalSection title="Integrations and channels">
          <p>
            OAuth and API connections are per-user. If a connector fails after
            working before, try disconnecting and reconnecting. For channel
            plugins (Slack, Telegram, and others), include the channel type and
            whether the issue is inbound, outbound, or both.
          </p>
        </LegalSection>

        <LegalSection title="Privacy and data">
          <p>
            For data access, deletion, or privacy questions, see our{' '}
            <LegalLink href="/privacy">Privacy Policy</LegalLink> and{' '}
            <LegalLink href="/terms">Terms of Service</LegalLink>, or email{' '}
            <LegalLink href={`mailto:${privacyEmail}`}>
              {privacyEmail}
            </LegalLink>
            .
          </p>
        </LegalSection>

        <LegalSection title="Open source">
          <p>
            {siteConfig.name} is open source. Bug reports and feature discussion
            belong on{' '}
            <LegalLink external href={githubRepositoryUrl}>
              GitHub
            </LegalLink>
            . For account-specific issues (billing, access, production data),
            email{' '}
            <LegalLink href={`mailto:${supportEmail}`}>
              {supportEmail}
            </LegalLink>{' '}
            instead.
          </p>
        </LegalSection>

        <LegalSection title="Security issues">
          <p>
            If you believe you found a security vulnerability, email{' '}
            <LegalLink href={`mailto:${supportEmail}`}>
              {supportEmail}
            </LegalLink>{' '}
            with details. Please do not post exploit steps publicly before we
            have had a chance to respond.
          </p>
        </LegalSection>
      </div>

      <div className="mt-12 border-border border-t pt-6">
        <Link
          className="inline-flex min-h-11 items-center border border-border px-4 font-bold text-xs uppercase tracking-[0.16em] transition-colors hover:bg-foreground hover:text-background"
          href="/"
        >
          Back to home
        </Link>
      </div>
    </MarketingLegalLayout>
  )
}
