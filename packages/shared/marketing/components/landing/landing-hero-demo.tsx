'use client'

import { getAppLoginUrl } from '@outname/shared/app-url'
import {
  PrimaryLink,
  SecondaryLink,
} from '@outname/shared/marketing/components/landing/landing-links'
import { TextLoop } from '@outname/shared/marketing/components/motion-primitives/text-loop'

const loopWords = [
  'agents',
  'tools',
  'sub-agents',
  'channels',
  'memory',
] as const

export function LandingHeroDemo({
  shouldReduceMotion,
  waitlistEnabled,
}: {
  shouldReduceMotion: boolean
  waitlistEnabled: boolean
}) {
  return (
    <section className="relative px-4 pt-24 pb-24 sm:px-6 sm:pt-28 md:px-10 md:pb-32 lg:px-12 lg:pt-32 lg:pb-40">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 border-foreground border-t-4 pt-5 lg:min-h-[calc(100vh-9rem)] lg:justify-between">
        <p className="swiss-label text-accent">
          OUTNA.ME /
          <TextLoop
            className="ml-2 inline-flex"
            interval={1.7}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            trigger={!shouldReduceMotion}
          >
            {loopWords.map((word) => (
              <span key={word}>{word}</span>
            ))}
          </TextLoop>
        </p>

        <div className="min-w-0">
          <h1 className="home-display text-balance font-black text-6xl uppercase leading-[0.84] tracking-normal sm:text-7xl md:text-[6rem] lg:text-[8rem] xl:text-[10rem] 2xl:text-[12rem]">
            Agents that keep working.
          </h1>
        </div>

        <div className="grid gap-8 border-foreground border-t-2 pt-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <p className="max-w-2xl text-base leading-relaxed md:text-lg">
            They remember. They learn. They call other agents. Every run
            sharpens the next.
          </p>
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row md:justify-end">
            {waitlistEnabled ? (
              <PrimaryLink href="/waitlist?source=landing-hero">
                Join the waitlist
              </PrimaryLink>
            ) : null}
            <SecondaryLink href={getAppLoginUrl('/agents/new')}>
              Login
            </SecondaryLink>
          </div>
        </div>
      </div>
    </section>
  )
}
