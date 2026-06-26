'use client'

import {
  revealVariants,
  staggerVariants,
} from '@outname/shared/marketing/components/landing/landing-motion'
import { platformPrimitives } from '@outname/shared/marketing/data/primitives'
import { domAnimation, LazyMotion, m as motion } from 'motion/react'

export function LandingPrimitives({
  shouldReduceMotion,
}: {
  shouldReduceMotion: boolean
}) {
  return (
    <section
      className="px-4 py-20 sm:px-6 md:px-10 md:py-28 lg:px-12"
      id="primitives"
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
                Built on primitives
              </p>
              <h2 className="mt-4 text-balance font-semibold text-3xl leading-tight tracking-tight md:text-4xl">
                Nothing you can't host yourself.
              </h2>
            </div>
            <p className="max-w-2xl text-muted-foreground leading-relaxed">
              outname is open source and sits on building blocks you already
              trust. Bring your own keys, swap the providers, run the whole
              thing on your own infrastructure.
            </p>
          </motion.div>

          <motion.ul
            className="mt-10 grid gap-px border border-border bg-border sm:grid-cols-2 lg:grid-cols-4"
            variants={revealVariants}
          >
            {platformPrimitives.map((primitive, index) => (
              <li
                className="flex min-h-44 flex-col bg-background p-5"
                key={primitive.id}
              >
                <span className="font-mono text-[10px] text-muted-foreground tracking-normal">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <p className="mt-4 font-semibold text-base tracking-tight">
                  {primitive.name}
                </p>
                {primitive.meta ? (
                  <p className="mt-1 font-mono text-[10px] text-muted-foreground tracking-normal">
                    {primitive.meta}
                  </p>
                ) : null}
                <p className="mt-auto pt-4 text-muted-foreground text-sm leading-relaxed">
                  {primitive.role}
                </p>
              </li>
            ))}
          </motion.ul>
        </motion.div>
      </LazyMotion>
    </section>
  )
}
