'use client'

import {
  revealVariants,
  staggerVariants,
} from '@outname/shared/marketing/components/landing/landing-motion'
import {
  anatomyStepCount,
  anatomySteps,
} from '@outname/shared/marketing/data/agent-anatomy'
import { m as motion } from 'motion/react'
import { AgentFileTree } from './agent-file-tree'
import { AnatomyStepDetail } from './anatomy-step-detail'

export function AnatomyStacked({
  shouldReduceMotion,
}: {
  shouldReduceMotion: boolean
}) {
  return (
    <motion.div
      className="mx-auto mt-10 max-w-7xl"
      initial={shouldReduceMotion ? false : 'hidden'}
      variants={staggerVariants}
      viewport={{ margin: '-80px', once: true }}
      whileInView="visible"
    >
      <motion.div className="lg:hidden" variants={revealVariants}>
        <AgentFileTree />
      </motion.div>

      <div className="mt-6 grid gap-4 lg:mt-0 lg:grid-cols-2">
        {anatomySteps.map((step) => (
          <motion.div
            className="border border-border bg-background p-6 lg:p-8"
            key={step.id}
            variants={revealVariants}
          >
            <AnatomyStepDetail step={step} total={anatomyStepCount} />
          </motion.div>
        ))}
      </div>
    </motion.div>
  )
}
