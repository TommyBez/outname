'use client'

import { Compose } from '@outname/shared/marketing/components/landing/compose'
import { Configure } from '@outname/shared/marketing/components/landing/configure'
import { Continuity } from '@outname/shared/marketing/components/landing/continuity'
import { Control } from '@outname/shared/marketing/components/landing/control'
import { Faq } from '@outname/shared/marketing/components/landing/faq'
import { FinalCta } from '@outname/shared/marketing/components/landing/final-cta'
import { Hero } from '@outname/shared/marketing/components/landing/hero'
import { HowItWorks } from '@outname/shared/marketing/components/landing/how-it-works'
import { Memory } from '@outname/shared/marketing/components/landing/memory'
import { OpenSource } from '@outname/shared/marketing/components/landing/open-source'
import { Reframe } from '@outname/shared/marketing/components/landing/reframe'
import { SiteFooter } from '@outname/shared/marketing/components/landing/site-footer'
import { SiteHeader } from '@outname/shared/marketing/components/landing/site-header'
import { useReducedMotion } from 'motion/react'

export function LandingHomePage({
  waitlistEnabled,
}: {
  waitlistEnabled: boolean
}) {
  const shouldReduceMotion = Boolean(useReducedMotion())

  return (
    <main className="relative isolate overflow-x-clip bg-background text-foreground">
      <div
        aria-hidden
        className="swiss-grid-pattern pointer-events-none absolute inset-0 -z-10 opacity-80"
      />
      <SiteHeader waitlistEnabled={waitlistEnabled} />
      <Hero
        shouldReduceMotion={shouldReduceMotion}
        waitlistEnabled={waitlistEnabled}
      />
      <Reframe />
      <HowItWorks />
      <Configure />
      <Continuity />
      <Memory />
      <Compose />
      <Control />
      <OpenSource />
      <Faq />
      <FinalCta waitlistEnabled={waitlistEnabled} />
      <SiteFooter waitlistEnabled={waitlistEnabled} />
    </main>
  )
}
