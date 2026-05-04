'use client'

import { useReducedMotion } from 'motion/react'
import { LandingFeatureWorkbench } from '@/components/landing/landing-feature-workbench'
import { LandingFinalCta } from '@/components/landing/landing-final-cta'
import { LandingHeroSection } from '@/components/landing/landing-hero-section'
import { LandingMemoryReviewShowcase } from '@/components/landing/landing-memory-review-showcase'
import { LandingNav } from '@/components/landing/landing-nav'
import { LandingSurfaceMap } from '@/components/landing/landing-surface-map'
import { LandingToolShowcase } from '@/components/landing/landing-tool-showcase'

export function LandingHomePage() {
  const shouldReduceMotion = useReducedMotion()
  const reduceMotionFlag = Boolean(shouldReduceMotion)

  return (
    <main className="relative isolate overflow-x-clip bg-background text-foreground">
      <div
        aria-hidden
        className="swiss-grid-pattern pointer-events-none absolute inset-0 -z-10 opacity-80"
      />
      <LandingNav />

      <section className="relative px-4 pt-24 pb-16 sm:px-6 sm:pt-28 md:px-10 lg:px-12">
        <div className="mx-auto grid w-full max-w-7xl gap-8">
          <LandingHeroSection shouldReduceMotion={shouldReduceMotion} />
          <div className="min-w-0">
            <LandingFeatureWorkbench shouldReduceMotion={reduceMotionFlag} />
          </div>
        </div>
      </section>

      <LandingSurfaceMap shouldReduceMotion={reduceMotionFlag} />
      <LandingToolShowcase shouldReduceMotion={reduceMotionFlag} />
      <LandingMemoryReviewShowcase shouldReduceMotion={reduceMotionFlag} />
      <LandingFinalCta shouldReduceMotion={reduceMotionFlag} />
    </main>
  )
}
