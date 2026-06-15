'use client'

import { getAppLoginUrl } from '@outname/shared/app-url'
import { MockRoster } from '@outname/shared/marketing/components/landing/mock-roster'
import { PrimaryLink } from '@outname/shared/marketing/components/landing/primary-link'
import { SecondaryLink } from '@outname/shared/marketing/components/landing/secondary-link'
import { SwissLabel } from '@outname/shared/marketing/components/landing/section-kit'
import { TextLoop } from '@outname/shared/marketing/components/motion-primitives/text-loop'

const LOOP_WORDS = [
  'memory',
  'schedules',
  'tools',
  'sub-agents',
  'skills',
  'budgets',
] as const

export function Hero({
  shouldReduceMotion,
  waitlistEnabled,
}: {
  shouldReduceMotion: boolean
  waitlistEnabled: boolean
}) {
  return (
    <section className="relative px-4 pt-16 pb-20 sm:px-6 sm:pt-20 md:px-10 md:pb-28 lg:px-12 lg:pt-24">
      <div className="mx-auto w-full max-w-7xl border-foreground border-t-4 pt-6">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <SwissLabel className="text-accent">
            Hosted personal AI agents
          </SwissLabel>
          <span aria-hidden className="text-muted-foreground">
            /
          </span>
          <TextLoop
            className="swiss-label inline-flex text-muted-foreground"
            interval={1.8}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            trigger={!shouldReduceMotion}
          >
            {LOOP_WORDS.map((word) => (
              <span key={word}>{word}</span>
            ))}
          </TextLoop>
        </p>

        <h1 className="mt-8 text-balance font-black text-6xl uppercase leading-[0.84] tracking-tight sm:text-7xl md:text-[6.5rem] lg:text-[8.5rem] xl:text-[10rem]">
          Agents that keep working.
        </h1>

        <div className="mt-10 grid gap-10 border-foreground border-t-2 pt-8 lg:grid-cols-[minmax(0,1fr)_26rem] lg:gap-14">
          <div className="flex flex-col">
            <p className="max-w-xl text-balance text-lg leading-relaxed md:text-xl">
              A hosted control plane for personal AI agents. Give one a role, a
              schedule, readable memory, and tools — then it keeps your
              recurring work moving, run after run.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              {waitlistEnabled ? (
                <PrimaryLink href="/waitlist?source=landing-hero">
                  Join the waitlist
                </PrimaryLink>
              ) : null}
              <SecondaryLink href={getAppLoginUrl('/dashboard')}>
                Sign in
              </SecondaryLink>
            </div>

            <p className="mt-6 font-mono text-muted-foreground text-xs leading-relaxed">
              Invite-only early access · Use your own inference provider key ·
              Open source (MIT)
            </p>
          </div>

          <div className="lg:pl-4">
            <MockRoster />
          </div>
        </div>
      </div>
    </section>
  )
}
