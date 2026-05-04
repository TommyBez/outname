'use client'

import { ArrowRightIcon } from 'lucide-react'
import { motion } from 'motion/react'
import Link from 'next/link'
import { routeLinks } from '@/components/landing/landing-data'
import {
  revealVariants,
  staggerVariants,
} from '@/components/landing/landing-motion'

export function LandingSurfaceMap({
  shouldReduceMotion,
}: {
  shouldReduceMotion: boolean
}) {
  return (
    <section className="px-4 py-20 sm:px-6 md:px-10 md:py-28 lg:px-12">
      <motion.div
        className="mx-auto max-w-7xl"
        initial={shouldReduceMotion ? false : 'hidden'}
        variants={staggerVariants}
        viewport={{ once: true, margin: '-80px' }}
        whileInView="visible"
      >
        <motion.div
          className="grid gap-5 border-foreground border-t-4 pt-5 md:grid-cols-[minmax(0,0.74fr)_minmax(0,1.26fr)] md:items-end"
          variants={revealVariants}
        >
          <div>
            <p className="swiss-label text-accent">Workspace</p>
            <h2 className="mt-4 text-balance font-black text-5xl uppercase leading-[0.88] tracking-normal md:text-7xl">
              One place to manage every agent.
            </h2>
          </div>
          <p className="max-w-2xl text-muted-foreground leading-relaxed">
            Move from dashboard to chat, memory, tools, and connections without
            losing the thread.
          </p>
        </motion.div>

        <motion.div
          className="mt-8 grid border-foreground border-t-2 md:grid-cols-2 xl:grid-cols-3"
          variants={staggerVariants}
        >
          {routeLinks.map((route) => {
            const Icon = route.icon
            return (
              <motion.div
                className="border-foreground border-r-2 border-b-2 md:nth-[2n]:border-r-0 xl:nth-[2n]:border-r-2 xl:nth-[3n]:border-r-0"
                key={route.label}
                variants={revealVariants}
              >
                <Link
                  className="group ease grid min-h-44 grid-rows-[auto_1fr_auto] bg-background p-5 transition-colors duration-150 hover:bg-foreground hover:text-background"
                  href={route.href}
                >
                  <div className="flex items-center justify-between">
                    <Icon className="size-5" />
                    <ArrowRightIcon className="ease size-4 transition-transform duration-150 group-hover:translate-x-1" />
                  </div>
                  <p className="mt-8 font-black text-3xl uppercase leading-none tracking-normal">
                    {route.label}
                  </p>
                  <p className="mt-5 font-mono text-muted-foreground text-xs uppercase tracking-normal group-hover:text-background/65">
                    {route.meta}
                  </p>
                </Link>
              </motion.div>
            )
          })}
        </motion.div>
      </motion.div>
    </section>
  )
}
