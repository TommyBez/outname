'use client'

import { LandingComposableWorkbench } from '@outname/shared/marketing/components/landing/composable-workbench/landing-composable-workbench'
import { LandingChatShowcase } from '@outname/shared/marketing/components/landing/landing-chat-showcase'
import { LandingFooter } from '@outname/shared/marketing/components/landing/landing-footer'
import { LandingHeartbeatCloser } from '@outname/shared/marketing/components/landing/landing-heartbeat-closer'
import { LandingHeroDemo } from '@outname/shared/marketing/components/landing/landing-hero-demo'
import { LandingNav } from '@outname/shared/marketing/components/landing/landing-nav'
import { useReducedMotion } from 'motion/react'

export function LandingHomePage() {
  const shouldReduceMotion = useReducedMotion()
  const reduceMotionFlag = Boolean(shouldReduceMotion)

  return (
    <main className="relative isolate overflow-x-clip bg-background text-foreground">
      <LandingNav />

      <LandingHeroDemo shouldReduceMotion={reduceMotionFlag} />
      <LandingChatShowcase shouldReduceMotion={reduceMotionFlag} />
      <LandingComposableWorkbench shouldReduceMotion={reduceMotionFlag} />
      <LandingHeartbeatCloser shouldReduceMotion={reduceMotionFlag} />
      <LandingFooter />
    </main>
  )
}
