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
  const useStackedFallback =
    shouldReduceMotion || isDesktop === undefined || !isDesktop

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
                Inside the sandbox
              </p>
              <h2 className="mt-4 text-balance font-semibold text-3xl leading-tight tracking-tight md:text-4xl">
                Open the folder, file by file.
              </h2>
            </div>
            <p className="max-w-2xl text-muted-foreground leading-relaxed">
              Nine canonical markdown files, each with a job. Scroll to walk the
              tree — some you author, the rest the agent keeps current itself.
            </p>
          </motion.div>
        </motion.div>

        {useStackedFallback ? (
          <AnatomyStacked shouldReduceMotion={shouldReduceMotion} />
        ) : (
          <AnatomyPinned />
        )}
      </LazyMotion>
    </section>
  )
}
