import { LegalLink } from '@outname/shared/marketing/components/legal/legal-link'
import { LegalList } from '@outname/shared/marketing/components/legal/legal-list'
import { LegalSection } from '@outname/shared/marketing/components/legal/legal-section'
import { MarketingLegalLayout } from '@outname/shared/marketing/components/legal/marketing-legal-layout'
import { supportEmail } from '@outname/shared/marketing/data/contact'
import { githubRepositoryUrl } from '@outname/shared/marketing/data/social-links'
import { siteConfig } from '@outname/shared/server/site-metadata'
import type { Metadata } from 'next'

const lastUpdated = 'May 27, 2026'

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: `Terms governing your use of ${siteConfig.name}.`,
  alternates: {
    canonical: '/terms',
  },
}

export default function TermsPage() {
  return (
    <MarketingLegalLayout>
      <header className="mb-12 border-border border-t-4 pt-6 md:mb-16">
        <p className="swiss-label mb-4 text-brand">Legal</p>
        <h1 className="font-black font-serif text-5xl uppercase leading-[0.86] tracking-tighter sm:text-6xl">
          Terms of Service
        </h1>
        <p className="mt-6 max-w-xl border-border border-l pl-4 text-muted-foreground text-sm leading-relaxed">
          These terms govern access to and use of {siteConfig.name}. By using
          the service, you agree to them. Last updated {lastUpdated}.
        </p>
      </header>

      <div className="space-y-10">
        <LegalSection title="Agreement">
          <p>
            These Terms of Service (“Terms”) are a binding agreement between you
            and the operator of {siteConfig.name} (“we”, “us”, “our”) regarding
            your use of {siteConfig.url} and related products (the “Service”).
            If you do not agree, do not use the Service.
          </p>
          <p>
            Our <LegalLink href="/privacy">Privacy Policy</LegalLink> explains
            how we handle personal data and is incorporated into these Terms by
            reference.
          </p>
        </LegalSection>

        <LegalSection title="Eligibility and accounts">
          <p>
            You must be at least 16 years old and able to form a binding
            contract to use the Service. You are responsible for the accuracy of
            information you provide and for keeping your account credentials
            secure.
          </p>
          <p>
            Access may be limited to invited or provisioned users during early
            access. We may refuse, suspend, or terminate accounts that violate
            these Terms or pose a security or abuse risk.
          </p>
        </LegalSection>

        <LegalSection title="The service">
          <p>
            {siteConfig.name} provides tools to configure and run personal AI
            agents, including memory, schedules, integrations, channels, and
            sandboxed execution. Features may change, be added, or removed
            without notice, especially during early access.
          </p>
          <p>
            The Service is provided on an “as is” and “as available” basis. We
            do not guarantee uninterrupted operation, error-free agents, or
            specific outcomes from automated runs.
          </p>
        </LegalSection>

        <LegalSection title="Your responsibilities">
          <p>You agree to:</p>
          <LegalList>
            <li>
              Use the Service only for lawful purposes and in compliance with
              applicable laws and third-party terms (including connected
              platforms)
            </li>
            <li>
              Configure agents, tools, and connections with appropriate scope
              and oversight for your use case
            </li>
            <li>
              Obtain any permissions required before agents access or act on
              data belonging to others (for example teammates, customers, or
              contacts)
            </li>
            <li>
              Review agent outputs before relying on them for decisions with
              legal, financial, medical, or safety implications
            </li>
          </LegalList>
        </LegalSection>

        <LegalSection title="Acceptable use">
          <p>You must not:</p>
          <LegalList>
            <li>
              Use the Service to send spam, phishing, malware, or unlawful
              content
            </li>
            <li>
              Attempt to gain unauthorized access to systems, accounts, or data
            </li>
            <li>
              Reverse engineer, scrape, or overload the Service except as
              permitted by applicable open-source licenses for components we
              publish
            </li>
            <li>
              Use the Service to develop competing models or services through
              systematic extraction of our proprietary interfaces or data
            </li>
            <li>
              Misrepresent agent-generated content as human-authored where
              disclosure is required by law or platform rules
            </li>
          </LegalList>
          <p>
            We may investigate violations and cooperate with law enforcement
            where required.
          </p>
        </LegalSection>

        <LegalSection title="Your content and agent activity">
          <p>
            You retain ownership of content you submit and data you connect,
            subject to licenses you grant us to operate the Service. You grant
            us a limited license to host, process, transmit, and display that
            content solely to provide and improve the Service, including running
            agents and integrations you enable.
          </p>
          <p>
            You are responsible for content processed by your agents and for
            actions they take through tools and channels you configure,
            including messages sent to third parties on your behalf.
          </p>
        </LegalSection>

        <LegalSection title="Third-party services">
          <p>
            The Service integrates with third-party providers (for example
            email, messaging platforms, analytics, and AI inference). Your use
            of those services is subject to their terms and policies. We are not
            responsible for third-party outages, policy changes, or data
            handling outside our control.
          </p>
        </LegalSection>

        <LegalSection title="AI outputs">
          <p>
            Agents may produce inaccurate, incomplete, or inappropriate output.
            AI features are not a substitute for professional advice. You assume
            risk for how you use agent outputs and for configuring models,
            prompts, tools, and permissions.
          </p>
        </LegalSection>

        <LegalSection title="Fees">
          <p>
            During early access, the Service may be offered without charge or
            with experimental pricing. If we introduce paid plans, we will
            provide applicable terms before billing you. You are responsible for
            any taxes associated with paid services where required by law.
          </p>
        </LegalSection>

        <LegalSection title="Intellectual property">
          <p>
            We own the Service, its branding, and proprietary elements not
            covered by open-source licenses. Portions of the project may be
            available under open-source licenses on{' '}
            <LegalLink external href={githubRepositoryUrl}>
              GitHub
            </LegalLink>
            ; those licenses govern the licensed code, not your right to use the
            hosted Service itself.
          </p>
          <p>
            Feedback you provide may be used to improve the Service without
            obligation to you.
          </p>
        </LegalSection>

        <LegalSection title="Suspension and termination">
          <p>
            You may stop using the Service at any time. We may suspend or
            terminate access immediately if you breach these Terms, if required
            by law, or if continued operation poses risk to the Service or other
            users.
          </p>
          <p>
            Upon termination, your right to use the Service ends. Provisions
            that by nature should survive (including disclaimers, limitations of
            liability, and dispute terms) will survive.
          </p>
        </LegalSection>

        <LegalSection title="Disclaimers">
          <p>
            TO THE MAXIMUM EXTENT PERMITTED BY LAW, THE SERVICE IS PROVIDED
            WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS, IMPLIED, OR
            STATUTORY, INCLUDING IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS
            FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
          </p>
        </LegalSection>

        <LegalSection title="Limitation of liability">
          <p>
            TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE AND OUR SUPPLIERS WILL
            NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL,
            OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, DATA, GOODWILL, OR
            BUSINESS OPPORTUNITIES, ARISING FROM YOUR USE OF THE SERVICE.
          </p>
          <p>
            OUR TOTAL LIABILITY FOR ANY CLAIM ARISING OUT OF THESE TERMS OR THE
            SERVICE WILL NOT EXCEED THE GREATER OF (A) AMOUNTS YOU PAID US FOR
            THE SERVICE IN THE TWELVE MONTHS BEFORE THE CLAIM, OR (B) ONE
            HUNDRED US DOLLARS (USD $100), IF YOU HAVE NOT PAID US.
          </p>
          <p>
            Some jurisdictions do not allow certain limitations; in those cases,
            our liability is limited to the fullest extent permitted by law.
          </p>
        </LegalSection>

        <LegalSection title="Indemnification">
          <p>
            You will defend and indemnify us against claims, damages, and
            expenses (including reasonable legal fees) arising from your use of
            the Service, your content, your agents’ actions, or your violation
            of these Terms or applicable law, except to the extent caused by our
            gross negligence or willful misconduct.
          </p>
        </LegalSection>

        <LegalSection title="Changes">
          <p>
            We may modify these Terms. We will update the “Last updated” date
            when we do. Material changes may be communicated through the Service
            or by email where appropriate. Continued use after changes take
            effect constitutes acceptance.
          </p>
        </LegalSection>

        <LegalSection title="General">
          <p>
            These Terms are the entire agreement between you and us regarding
            the Service and supersede prior understandings on the same subject.
            If a provision is unenforceable, the remainder stays in effect. Our
            failure to enforce a provision is not a waiver. You may not assign
            these Terms without our consent; we may assign them in connection
            with a business transfer.
          </p>
          <p>
            Disputes will be resolved in accordance with applicable law in the
            jurisdiction where we primarily operate the Service, unless
            mandatory consumer protections in your country require otherwise.
          </p>
        </LegalSection>

        <LegalSection title="Contact">
          <p>
            Questions about these Terms:{' '}
            <LegalLink href={`mailto:${supportEmail}`}>
              {supportEmail}
            </LegalLink>
            . See also our <LegalLink href="/support">Support</LegalLink> page.
          </p>
        </LegalSection>
      </div>
    </MarketingLegalLayout>
  )
}
