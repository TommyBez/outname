'use client'

import {
  revealVariants,
  staggerVariants,
} from '@outname/shared/marketing/components/landing/landing-motion'
import { useIsDesktopViewport } from '@outname/shared/marketing/components/landing/use-is-desktop-viewport'
import { domAnimation, LazyMotion, m as motion } from 'motion/react'
import { AnatomyPinned } from './anatomy-pinned'
import { AnatomyStacked } from './anatomy-stacked'

export function LandingAgentAnatomy({
  shouldReduceMotion,
}: {
  shouldReduceMotion: boolean
}) {
  const isDesktop = useIsDesktopViewport()

  const renderWalkthrough = () => {
    if (shouldReduceMotion || isDesktop === undefined || !isDesktop) {
      return <AnatomyStacked shouldReduceMotion={shouldReduceMotion} />
    }
    return <AnatomyPinned />
  }

  return (
    <section
      className="px-4 py-20 sm:px-6 md:px-10 md:py-28 lg:px-12"
      id="anatomy"
    >
      <LazyMotion features={domAnimation}>
        <motion.div
          className="mx-auto max-w-7xl"
          initial={shouldReduceMotion ? false : 'hidden'}
          variants={staggerVariants}
          viewport={{ margin: '-80px', once: true }}
          whileInView="visible"
        >
          <motion.div
            className="grid gap-5 border-border border-t pt-5 md:grid-cols-[minmax(0,0.82fr)_minmax(0,1fr)] md:items-end"
            variants={revealVariants}
          >
            <div>
              <p className="swiss-label text-muted-foreground">
                Anatomy of an agent
              </p>
              <h2 className="mt-4 text-balance font-semibold text-3xl leading-tight tracking-tight md:text-4xl">
                An agent is a folder you can read.
              </h2>
            </div>
            <p className="max-w-2xl text-muted-foreground leading-relaxed">
              No black box. Memory, model, tools, channels, schedule: every
              capability is a file or a binding you can open, edit, and watch
              run.
            </p>
          </motion.div>
        </motion.div>

        {renderWalkthrough()}
      </LazyMotion>
    </section>
  )
}
