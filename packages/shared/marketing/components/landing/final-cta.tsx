'use client'

import { getAppLoginUrl } from '@outname/shared/app-url'
import { PrimaryLink } from '@outname/shared/marketing/components/landing/primary-link'
import { SecondaryLink } from '@outname/shared/marketing/components/landing/secondary-link'
import {
  Reveal,
  SwissLabel,
} from '@outname/shared/marketing/components/landing/section-kit'

export function FinalCta({ waitlistEnabled }: { waitlistEnabled: boolean }) {
  return (
    <section className="relative px-4 py-20 sm:px-6 md:px-10 md:py-28 lg:px-12">
      <div className="mx-auto w-full max-w-7xl border-foreground border-t-4 pt-6">
        <Reveal>
          <SwissLabel className="text-accent">Early access</SwissLabel>
          <h2 className="mt-6 text-balance font-black text-5xl uppercase leading-[0.86] tracking-tight sm:text-6xl md:text-7xl lg:text-8xl">
            Put an agent to work.
          </h2>
          <p className="mt-6 max-w-2xl text-base text-muted-foreground leading-relaxed md:text-lg">
            Join the waitlist for hosted personal AI agents. Invite-only while
            we validate recurring workflows with builders — then it keeps the
            work moving without you in the loop.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            {waitlistEnabled ? (
              <PrimaryLink href="/waitlist?source=landing-final-cta">
                Join the waitlist
              </PrimaryLink>
            ) : null}
            <SecondaryLink href={getAppLoginUrl('/dashboard')}>
              Sign in
            </SecondaryLink>
          </div>

          <p className="mt-6 font-mono text-muted-foreground text-xs leading-relaxed">
            Email OTP access · Use your own inference provider key · Three
            agents to start
          </p>
        </Reveal>
      </div>
    </section>
  )
}
