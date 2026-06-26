'use client'

import { LandingAgentAnatomy } from '@outname/shared/marketing/components/landing/agent-anatomy/landing-agent-anatomy'
import { LandingBindings } from '@outname/shared/marketing/components/landing/landing-bindings'
import { LandingChatShowcase } from '@outname/shared/marketing/components/landing/landing-chat-showcase'
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

      {/* 1 — Positioning, command, and the directory artifact */}
      <LandingHeroDemo shouldReduceMotion={reduceMotionFlag} />

      {/* 2 — An agent is a directory: overview + alternating file walkthrough */}
      <LandingAgentAnatomy shouldReduceMotion={reduceMotionFlag} />

      {/* 3 — What you bind around the folder */}
      <LandingBindings shouldReduceMotion={reduceMotionFlag} />

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
