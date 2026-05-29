import {
  LegalLink,
  LegalList,
  LegalSection,
} from '@outname/shared/marketing/components/legal/legal-prose'
import { MarketingLegalLayout } from '@outname/shared/marketing/components/legal/marketing-legal-layout'
import { privacyEmail } from '@outname/shared/marketing/data/contact'
import { siteConfig } from '@outname/shared/server/site-metadata'
import type { Metadata } from 'next'

const lastUpdated = 'May 27, 2026'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: `How ${siteConfig.name} collects, uses, and protects your data.`,
  alternates: {
    canonical: '/privacy',
  },
}

export default function PrivacyPage() {
  return (
    <MarketingLegalLayout>
      <header className="mb-12 border-foreground border-t-4 pt-6 md:mb-16">
        <p className="swiss-label mb-4 text-accent">Legal</p>
        <h1 className="font-black font-serif text-5xl uppercase leading-[0.86] tracking-tighter sm:text-6xl">
          Privacy Policy
        </h1>
        <p className="mt-6 max-w-xl border-foreground border-l-2 pl-4 text-muted-foreground text-sm leading-relaxed">
          This policy describes how {siteConfig.name} handles personal data when
          you use our website and product. Last updated {lastUpdated}.
        </p>
      </header>

      <div className="space-y-10">
        <LegalSection title="Who we are">
          <p>
            {siteConfig.name} ({siteConfig.url}) is operated as a hosted product
            for personal AI agents with memory, schedules, tools, and channel
            integrations. For privacy questions, contact{' '}
            <LegalLink href={`mailto:${privacyEmail}`}>
              {privacyEmail}
            </LegalLink>
            .
          </p>
        </LegalSection>

        <LegalSection id="data-we-collect" title="Data we collect">
          <p>Depending on how you use the service, we may process:</p>
          <LegalList>
            <li>
              <strong className="text-foreground">Account data</strong>, email
              address, display name, timezone, and session information used for
              sign-in and security.
            </li>
            <li>
              <strong className="text-foreground">Waitlist data</strong>, if you
              request early access, we store your email and any optional details
              you submit (such as use case or profile type), plus signup
              metadata like source and UTM parameters.
            </li>
            <li>
              <strong className="text-foreground">Product usage data</strong>,
              agent configuration, conversations, memory files, scheduled runs,
              tool activity, and related operational logs needed to run your
              agents.
            </li>
            <li>
              <strong className="text-foreground">
                Connected service data
              </strong>{' '}
              , when you connect third-party accounts (for example Slack, email,
              or analytics tools), we store credentials and tokens required to
              act on your behalf, encrypted at rest where applicable.
            </li>
            <li>
              <strong className="text-foreground">Technical data</strong>, IP
              address, browser type, and similar request metadata for security,
              rate limiting, and reliability.
            </li>
          </LegalList>
        </LegalSection>

        <LegalSection title="How we use data">
          <p>We use personal data to:</p>
          <LegalList>
            <li>Provide, secure, and maintain the service</li>
            <li>Authenticate you and manage your account</li>
            <li>
              Run agents, schedules, tools, and integrations you configure
            </li>
            <li>Send transactional email (sign-in codes, waitlist messages)</li>
            <li>Improve reliability, prevent abuse, and debug issues</li>
            <li>Comply with legal obligations</li>
          </LegalList>
          <p>
            We do not sell your personal data. Agent prompts and outputs may be
            sent to AI providers you configure (for example through an AI
            gateway) solely to deliver the features you request.
          </p>
        </LegalSection>

        <LegalSection title="Cookies and local storage">
          <p>
            We use essential cookies for authentication and session management.
            The app may also store UI preferences (for example sidebar state) in
            cookies or local storage. We use{' '}
            <LegalLink external href="https://vercel.com/docs/analytics">
              Vercel Web Analytics
            </LegalLink>{' '}
            on the site, which collects aggregated usage metrics without
            requiring you to be signed in.
          </p>
        </LegalSection>

        <LegalSection title="Processors and sharing">
          <p>
            We rely on infrastructure and service providers to operate{' '}
            {siteConfig.name}, including hosting, database, email delivery, and
            AI inference. Data may also be shared with third-party services you
            explicitly connect to your account.
          </p>
          <p>
            We may disclose information if required by law, to protect rights
            and safety, or in connection with a merger, acquisition, or asset
            sale, subject to appropriate safeguards.
          </p>
        </LegalSection>

        <LegalSection title="Retention">
          <p>
            We retain data for as long as your account is active or as needed to
            provide the service, comply with legal obligations, resolve
            disputes, and enforce agreements. You may request deletion of your
            account data subject to technical and legal limits.
          </p>
        </LegalSection>

        <LegalSection title="Security">
          <p>
            We apply reasonable technical and organizational measures to protect
            personal data, including access controls and encryption for
            sensitive credentials. No method of transmission or storage is
            completely secure; we cannot guarantee absolute security.
          </p>
        </LegalSection>

        <LegalSection title="Your rights">
          <p>
            Depending on where you live, you may have rights to access, correct,
            delete, or export your personal data, or to object to or restrict
            certain processing. To exercise these rights, email{' '}
            <LegalLink href={`mailto:${privacyEmail}`}>
              {privacyEmail}
            </LegalLink>
            . We will respond within a reasonable timeframe.
          </p>
        </LegalSection>

        <LegalSection title="International transfers">
          <p>
            Your data may be processed in countries other than your own,
            including where our providers operate. We take steps designed to
            ensure appropriate protections when data crosses borders.
          </p>
        </LegalSection>

        <LegalSection title="Children">
          <p>
            {siteConfig.name} is not directed at children under 16. We do not
            knowingly collect personal data from children. If you believe a
            child has provided us data, contact us and we will take appropriate
            steps.
          </p>
        </LegalSection>

        <LegalSection title="Changes">
          <p>
            We may update this policy from time to time. We will revise the
            “Last updated” date at the top when we do. Continued use of the
            service after changes means you accept the updated policy.
          </p>
        </LegalSection>

        <LegalSection title="Contact">
          <p>
            Privacy inquiries:{' '}
            <LegalLink href={`mailto:${privacyEmail}`}>
              {privacyEmail}
            </LegalLink>
            . See also our <LegalLink href="/terms">Terms of Service</LegalLink>{' '}
            and <LegalLink href="/support">Support</LegalLink> page.
          </p>
        </LegalSection>
      </div>
    </MarketingLegalLayout>
  )
}
