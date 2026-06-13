'use client'

import type { ProductHuntLaunchState } from '@outname/shared/launch/product-hunt'
import { LandingComposableWorkbench } from '@outname/shared/marketing/components/landing/composable-workbench/landing-composable-workbench'
import { LandingChatShowcase } from '@outname/shared/marketing/components/landing/landing-chat-showcase'
import { LandingFooter } from '@outname/shared/marketing/components/landing/landing-footer'
import { LandingHeartbeatCloser } from '@outname/shared/marketing/components/landing/landing-heartbeat-closer'
import { LandingHeroDemo } from '@outname/shared/marketing/components/landing/landing-hero-demo'
import { LandingNav } from '@outname/shared/marketing/components/landing/landing-nav'
import { ProductHuntFeedbackSection } from '@outname/shared/marketing/components/landing/product-hunt-feedback-section'
import {
  ProductHuntLaunchPanel,
  ProductHuntVercelStackSection,
} from '@outname/shared/marketing/components/landing/product-hunt-launch-panel'
import { useReducedMotion } from 'motion/react'

export type LandingSurface = 'default' | 'product-hunt'

export function LandingHomePage({
  launchState = null,
  surface = 'default',
  waitlistEnabled,
}: {
  launchState?: ProductHuntLaunchState | null
  surface?: LandingSurface
  waitlistEnabled: boolean
}) {
  const shouldReduceMotion = useReducedMotion()
  const reduceMotionFlag = Boolean(shouldReduceMotion)

  return (
    <main className="relative isolate overflow-x-clip bg-background text-foreground">
      <div
        aria-hidden
        className="swiss-grid-pattern pointer-events-none absolute inset-0 -z-10 opacity-80"
      />
      <LandingNav waitlistEnabled={waitlistEnabled} />

      <ProductHuntLaunchPanel
        launchState={launchState}
        waitlistEnabled={waitlistEnabled}
      />
      <LandingHeroDemo
        launchState={launchState}
        shouldReduceMotion={reduceMotionFlag}
        surface={surface}
        waitlistEnabled={waitlistEnabled}
      />
      <ProductHuntVercelStackSection
        forceVisible={surface === 'product-hunt'}
        launchState={launchState}
      />
      {surface === 'product-hunt' ? <ProductHuntFeedbackSection /> : null}
      <LandingChatShowcase shouldReduceMotion={reduceMotionFlag} />
      <LandingComposableWorkbench shouldReduceMotion={reduceMotionFlag} />
      <LandingHeartbeatCloser
        shouldReduceMotion={reduceMotionFlag}
        waitlistEnabled={waitlistEnabled}
      />
      <LandingFooter />
    </main>
  )
}
