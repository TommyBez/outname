'use client'

import { useReducedMotion } from 'motion/react'
import { LandingChatShowcase } from '@/marketing/components/landing/landing-chat-showcase'
import { LandingComposableWorkbench } from '@/marketing/components/landing/landing-composable-workbench'
import { LandingHeartbeatCloser } from '@/marketing/components/landing/landing-heartbeat-closer'
import { LandingHeroDemo } from '@/marketing/components/landing/landing-hero-demo'
import { LandingNav } from '@/marketing/components/landing/landing-nav'

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

      <LandingHeroDemo shouldReduceMotion={reduceMotionFlag} />
      <LandingChatShowcase shouldReduceMotion={reduceMotionFlag} />
      <LandingComposableWorkbench shouldReduceMotion={reduceMotionFlag} />
      <LandingHeartbeatCloser shouldReduceMotion={reduceMotionFlag} />
    </main>
  )
}
