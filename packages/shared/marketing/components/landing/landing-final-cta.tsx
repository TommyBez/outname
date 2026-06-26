'use client'

import { getAppLoginUrl } from '@outname/shared/app-url'
import {
  revealVariants,
  staggerVariants,
} from '@outname/shared/marketing/components/landing/landing-motion'
import { PrimaryLink } from '@outname/shared/marketing/components/landing/primary-link'
import { SecondaryLink } from '@outname/shared/marketing/components/landing/secondary-link'
import { domAnimation, LazyMotion, m as motion } from 'motion/react'

export function LandingFinalCta({
  shouldReduceMotion,
}: {
  shouldReduceMotion: boolean
}) {
  return (
    <section
      className="px-4 pt-10 pb-24 sm:px-6 md:px-10 md:pb-32 lg:px-12"
      id="start"
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
            className="border-border border-t pt-8"
            variants={revealVariants}
          >
            <p className="swiss-label text-muted-foreground">
              Start your first agent
            </p>
            <div className="mt-6 grid gap-8 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] md:items-end">
              <h2 className="home-display text-balance font-semibold text-4xl leading-[1.05] tracking-tight md:text-5xl lg:text-6xl">
                Give it a folder. Watch it work.
              </h2>
              <div className="flex min-w-0 flex-col gap-3 sm:flex-row md:justify-end">
                <PrimaryLink href={getAppLoginUrl('/agents/new')}>
                  Create an account
                </PrimaryLink>
                <SecondaryLink href={getAppLoginUrl('/dashboard')}>
                  Login
                </SecondaryLink>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </LazyMotion>
    </section>
  )
}
