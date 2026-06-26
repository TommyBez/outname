'use client'

import { LandingAgentAnatomy } from '@outname/shared/marketing/components/landing/agent-anatomy/landing-agent-anatomy'
import { LandingChatShowcase } from '@outname/shared/marketing/components/landing/landing-chat-showcase'
import { LandingConcept } from '@outname/shared/marketing/components/landing/landing-concept'
import { LandingFinalCta } from '@outname/shared/marketing/components/landing/landing-final-cta'
import { LandingFooter } from '@outname/shared/marketing/components/landing/landing-footer'
import { LandingHeartbeatCloser } from '@outname/shared/marketing/components/landing/landing-heartbeat-closer'
import { LandingHeroDemo } from '@outname/shared/marketing/components/landing/landing-hero-demo'
import { LandingNav } from '@outname/shared/marketing/components/landing/landing-nav'
import { LandingPrimitives } from '@outname/shared/marketing/components/landing/landing-primitives'
import { LandingProductionIntro } from '@outname/shared/marketing/components/landing/landing-production-intro'
import { useReducedMotion } from 'motion/react'

export function LandingHomePage() {
  const shouldReduceMotion = useReducedMotion()
  const reduceMotionFlag = Boolean(shouldReduceMotion)

  return (
    <main className="relative isolate overflow-x-clip bg-background text-foreground">
      <LandingNav />

      {/* 1 — Positioning + artifact */}
      <LandingHeroDemo shouldReduceMotion={reduceMotionFlag} />

      {/* 2 — The mental model: an agent is a directory */}
      <LandingConcept shouldReduceMotion={reduceMotionFlag} />

      {/* 3 — The capability tour through the directory */}
      <LandingAgentAnatomy shouldReduceMotion={reduceMotionFlag} />

      {/* 4 — What it's built on */}
      <LandingPrimitives shouldReduceMotion={reduceMotionFlag} />

      {/* 5 — Production readiness, then proven live */}
      <LandingProductionIntro shouldReduceMotion={reduceMotionFlag} />
      <LandingChatShowcase shouldReduceMotion={reduceMotionFlag} />
      <LandingHeartbeatCloser shouldReduceMotion={reduceMotionFlag} />

      {/* 6 — Final call to action */}
      <LandingFinalCta shouldReduceMotion={reduceMotionFlag} />

      <LandingFooter />
    </main>
  )
}
