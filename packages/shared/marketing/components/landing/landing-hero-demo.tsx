'use client'

import { getAppLoginUrl } from '@outname/shared/app-url'
import type { ProductHuntLaunchState } from '@outname/shared/launch/product-hunt'
import {
  buildProductHuntWaitlistPath,
  isProductHuntLaunchVisible,
  PRODUCT_HUNT_LAUNCH,
} from '@outname/shared/launch/product-hunt'
import { PrimaryLink } from '@outname/shared/marketing/components/landing/primary-link'
import { SecondaryLink } from '@outname/shared/marketing/components/landing/secondary-link'
import type { LandingSurface } from '@outname/shared/marketing/components/landing-home-page'
import { TextLoop } from '@outname/shared/marketing/components/motion-primitives/text-loop'

const loopWords = [
  'agents',
  'tools',
  'sub-agents',
  'channels',
  'memory',
] as const

export function LandingHeroDemo({
  launchState,
  shouldReduceMotion,
  surface,
  waitlistEnabled,
}: {
  launchState: ProductHuntLaunchState | null
  shouldReduceMotion: boolean
  surface: LandingSurface
  waitlistEnabled: boolean
}) {
  const isProductHuntSurface = surface === 'product-hunt'
  const showLaunchContext =
    isProductHuntSurface || isProductHuntLaunchVisible(launchState)
  const waitlistHref = showLaunchContext
    ? buildProductHuntWaitlistPath('hero')
    : '/waitlist?source=landing-hero'

  return (
    <section className="relative px-4 pt-16 pb-24 sm:px-6 sm:pt-20 md:px-10 md:pb-32 lg:px-12 lg:pt-24 lg:pb-40">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 border-foreground border-t-4 pt-5 lg:min-h-[calc(100vh-9rem)] lg:justify-between">
        <p className="swiss-label text-accent">
          {showLaunchContext
            ? `OUTNA.ME / ${PRODUCT_HUNT_LAUNCH.productHuntTag}`
            : 'OUTNA.ME /'}
          {showLaunchContext ? null : (
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
          )}
        </p>

        <div className="min-w-0">
          <h1 className="home-display text-balance font-black text-6xl uppercase leading-[0.84] tracking-normal sm:text-7xl md:text-[6rem] lg:text-[8rem] xl:text-[10rem] 2xl:text-[12rem]">
            {isProductHuntSurface
              ? 'Personal agents that keep working.'
              : 'Agents that keep working.'}
          </h1>
        </div>

        <div className="grid gap-8 border-foreground border-t-2 pt-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <p className="max-w-2xl text-base leading-relaxed md:text-lg">
            {isProductHuntSurface
              ? 'Hosted AI agents with memory, schedules, tools, channels, sub-agents, and sandboxed execution. Built for recurring work that should not wait for a fresh prompt.'
              : 'They remember. They learn. They call other agents. Every run sharpens the next.'}
          </p>
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row md:justify-end">
            {waitlistEnabled ? (
              <PrimaryLink href={waitlistHref}>Join the waitlist</PrimaryLink>
            ) : null}
            <SecondaryLink
              href={
                showLaunchContext
                  ? '#vercel-day-stack'
                  : getAppLoginUrl('/agents/new')
              }
            >
              {showLaunchContext ? 'See Vercel stack' : 'Login'}
            </SecondaryLink>
          </div>
        </div>
      </div>
    </section>
  )
}
