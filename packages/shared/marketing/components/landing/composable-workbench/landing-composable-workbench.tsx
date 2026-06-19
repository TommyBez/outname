'use client'

import {
  revealVariants,
  staggerVariants,
} from '@outname/shared/marketing/components/landing/landing-motion'
import { domAnimation, LazyMotion, m as motion } from 'motion/react'
import { ComposabilityMobileStory } from './composability-mobile-story'
import { ComposabilityPinned } from './composability-pinned'
import { ComposabilityStacked } from './composability-stacked'
import { useIsDesktopViewport } from './use-is-desktop-viewport'

export function LandingComposableWorkbench({
  shouldReduceMotion,
}: {
  shouldReduceMotion: boolean
}) {
  const isDesktop = useIsDesktopViewport()

  return (
    <section
      className="px-4 py-20 sm:px-6 md:px-10 md:py-28 lg:px-12"
      id="workbench"
    >
      <LazyMotion features={domAnimation}>
        <motion.div
          className="mx-auto max-w-7xl"
          initial={shouldReduceMotion ? false : 'hidden'}
          variants={staggerVariants}
          viewport={{ once: true, margin: '-80px' }}
          whileInView="visible"
        >
          <motion.div
            className="grid gap-5 border-border border-t-4 pt-5 md:grid-cols-[minmax(0,0.82fr)_minmax(0,1fr)] md:items-end"
            variants={revealVariants}
          >
            <div>
              <p className="swiss-label text-brand">Anatomy of an agent</p>
              <h2 className="mt-4 text-balance font-semibold text-5xl leading-[0.88] tracking-normal md:text-7xl">
                An agent is what you attach to it.
              </h2>
            </div>
            <p className="max-w-2xl text-muted-foreground leading-relaxed">
              The agent is a shell. Capabilities snap into named slots. You see
              what's attached, what ran, what changed.
            </p>
          </motion.div>
        </motion.div>

        {(() => {
          if (shouldReduceMotion || isDesktop === undefined) {
            return <ComposabilityStacked />
          }
          return isDesktop ? (
            <ComposabilityPinned />
          ) : (
            <ComposabilityMobileStory />
          )
        })()}
      </LazyMotion>
    </section>
  )
}
