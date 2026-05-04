'use client'

import { motion } from 'motion/react'
import { PrimaryLink } from '@/components/landing/landing-links'
import { revealVariants } from '@/components/landing/landing-motion'

export function LandingFinalCta({
  shouldReduceMotion,
}: {
  shouldReduceMotion: boolean
}) {
  return (
    <section className="px-4 pt-10 pb-24 sm:px-6 md:px-10 md:pb-32 lg:px-12">
      <motion.div
        className="mx-auto grid max-w-7xl gap-8 border-4 border-foreground bg-background p-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-end md:p-10"
        initial={shouldReduceMotion ? false : 'hidden'}
        variants={revealVariants}
        viewport={{ once: true, margin: '-80px' }}
        whileInView="visible"
      >
        <div>
          <p className="swiss-label text-accent">Build</p>
          <h2 className="mt-4 max-w-4xl text-balance font-black text-5xl uppercase leading-[0.88] tracking-normal md:text-8xl">
            Start with one agent you can inspect.
          </h2>
        </div>
        <PrimaryLink href="/login?from=/agents/new">Create agent</PrimaryLink>
      </motion.div>
    </section>
  )
}
