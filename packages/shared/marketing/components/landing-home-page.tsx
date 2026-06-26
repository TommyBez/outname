'use client'

import { LandingAgentAnatomy } from '@outname/shared/marketing/components/landing/agent-anatomy/landing-agent-anatomy'
import { LandingChatShowcase } from '@outname/shared/marketing/components/landing/landing-chat-showcase'
import { LandingFooter } from '@outname/shared/marketing/components/landing/landing-footer'
import { LandingHeartbeatCloser } from '@outname/shared/marketing/components/landing/landing-heartbeat-closer'
import { LandingHeroDemo } from '@outname/shared/marketing/components/landing/landing-hero-demo'
import { LandingNav } from '@outname/shared/marketing/components/landing/landing-nav'
import { LandingPrimitives } from '@outname/shared/marketing/components/landing/landing-primitives'
import { useReducedMotion } from 'motion/react'

export function LandingHomePage() {
  const shouldReduceMotion = useReducedMotion()
  const reduceMotionFlag = Boolean(shouldReduceMotion)

  return (
    <main className="relative isolate overflow-x-clip bg-background text-foreground">
      <LandingNav />

      <LandingHeroDemo shouldReduceMotion={reduceMotionFlag} />
      <LandingAgentAnatomy shouldReduceMotion={reduceMotionFlag} />
      <LandingChatShowcase shouldReduceMotion={reduceMotionFlag} />
      <LandingPrimitives shouldReduceMotion={reduceMotionFlag} />
      <LandingHeartbeatCloser shouldReduceMotion={reduceMotionFlag} />
      <LandingFooter />
    </main>
  )
}
