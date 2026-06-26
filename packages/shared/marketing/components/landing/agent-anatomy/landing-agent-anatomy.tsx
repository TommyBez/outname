'use client'

import {
  revealVariants,
  staggerVariants,
} from '@outname/shared/marketing/components/landing/landing-motion'
import {
  type AnatomyStep,
  anatomyStepCount,
  anatomySteps,
  ownerLabel,
} from '@outname/shared/marketing/data/agent-anatomy'
import { Badge } from '@outname/ui/components/ui/badge'
import { cn } from '@outname/ui/lib/utils'
import { domAnimation, LazyMotion, m as motion } from 'motion/react'
import { AgentFileTree } from './agent-file-tree'
import { AnatomyCodeBlock } from './anatomy-step-detail'
import { stepIcons } from './constants'

function DirectoryOverview() {
  return (
    <motion.div
      className="mt-10 grid gap-5 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] lg:items-start"
      variants={revealVariants}
    >
      <AgentFileTree />
      <ol className="grid gap-px self-stretch border border-border bg-border sm:grid-cols-2 [&>li:last-child]:sm:col-span-2">
        {anatomySteps.map((step) => (
          <li key={step.id}>
            <a
              className="ease flex h-full items-baseline gap-3 bg-background px-4 py-3 transition-colors duration-150 hover:bg-muted"
              href={`#anatomy-${step.id}`}
            >
              <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                {step.index}
              </span>
              <span className="min-w-0">
                <span className="block font-mono text-xs">
                  {fileNameFor(step)}
                </span>
                <span className="mt-0.5 block text-muted-foreground text-xs leading-snug">
                  {step.title}
                </span>
              </span>
            </a>
          </li>
        ))}
      </ol>
    </motion.div>
  )
}

const fileLabels: Record<string, string> = {
  calendar: 'CALENDAR.md',
  dreams: 'DREAMS.md',
  goals: 'GOALS.md',
  identity: 'IDENTITY.md',
  instructions: 'AGENTS.md',
  memory: 'MEMORY.md',
  soul: 'SOUL.md',
  tasks: 'TASKS.md',
  user: 'USER.md',
}

function fileNameFor(step: AnatomyStep): string {
  return fileLabels[step.node] ?? step.node
}

function AnatomyRow({ step, index }: { step: AnatomyStep; index: number }) {
  const Icon = stepIcons[step.id]
  const codeOnLeft = index % 2 === 1

  return (
    <motion.li
      className="border-border border-t pt-10 md:pt-14"
      id={`anatomy-${step.id}`}
      variants={revealVariants}
    >
      <div className="grid gap-8 md:grid-cols-2 md:gap-12 lg:items-center">
        <div className={cn(codeOnLeft && 'md:order-2')}>
          <div className="flex items-center gap-4">
            <span className="font-mono text-2xl text-muted-foreground tabular-nums">
              {step.index}
            </span>
            <span className="grid size-10 place-items-center border border-border bg-brand text-brand-foreground">
              <Icon className="size-4" />
            </span>
            <span className="font-mono text-muted-foreground text-xs">
              {fileNameFor(step)}
            </span>
          </div>
          <h3 className="mt-6 text-balance font-semibold text-2xl leading-tight tracking-tight md:text-3xl">
            {step.title}
          </h3>
          <p className="mt-4 max-w-md text-muted-foreground leading-relaxed">
            {step.caption}
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <Badge
              className={cn(
                step.owner === 'user' &&
                  'border-transparent bg-brand text-brand-foreground'
              )}
              variant={step.owner === 'user' ? 'default' : 'outline'}
            >
              {ownerLabel[step.owner]}
            </Badge>
            <span className="swiss-label text-muted-foreground">
              {step.note}
            </span>
          </div>
        </div>
        <div className={cn(codeOnLeft && 'md:order-1')}>
          <AnatomyCodeBlock code={step.code} />
        </div>
      </div>
    </motion.li>
  )
}

export function LandingAgentAnatomy({
  shouldReduceMotion,
}: {
  shouldReduceMotion: boolean
}) {
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
                The mental model
              </p>
              <h2 className="mt-4 text-balance font-semibold text-3xl leading-tight tracking-tight md:text-4xl">
                An agent is a directory.
              </h2>
            </div>
            <p className="max-w-2xl text-muted-foreground leading-relaxed">
              Nine canonical markdown files in a sandbox, each with a job. Some
              you author; the rest the agent keeps current itself. No black box
              — every file is one you could open and edit.
            </p>
          </motion.div>

          <DirectoryOverview />

          <ol className="mt-16 grid gap-0">
            {anatomySteps.map((step, index) => (
              <AnatomyRow index={index} key={step.id} step={step} />
            ))}
          </ol>

          <motion.p
            className="mt-12 border-border border-t pt-6 font-mono text-[11px] text-muted-foreground tracking-normal"
            variants={revealVariants}
          >
            {anatomyStepCount} files · one folder you can read end to end
          </motion.p>
        </motion.div>
      </LazyMotion>
    </section>
  )
}
