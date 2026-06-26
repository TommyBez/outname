'use client'

import { CodeLines } from '@outname/shared/marketing/components/landing/code-block'
import {
  revealVariants,
  staggerVariants,
} from '@outname/shared/marketing/components/landing/landing-motion'
import {
  type AnatomyStep,
  agentSlug,
  anatomySteps,
  ownerLabel,
} from '@outname/shared/marketing/data/agent-anatomy'
import { cn } from '@outname/ui/lib/utils'
import {
  domAnimation,
  LazyMotion,
  m as motion,
  useMotionValueEvent,
  useScroll,
} from 'motion/react'
import { useRef, useState } from 'react'
import { stepIcons } from './constants'

const ACTIVE_LINE_RATIO = 0.4
const fileNameByNode: Record<string, string> = {
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
  return fileNameByNode[step.node] ?? step.node
}

function CodePanel({ step }: { step: AnatomyStep }) {
  const Icon = stepIcons[step.id]
  const fileName = fileNameFor(step)

  return (
    <div className="border border-border bg-card">
      <div className="flex items-center justify-between gap-3 border-border border-b px-5 py-3">
        <span className="font-mono text-muted-foreground text-xs tracking-normal">
          {agentSlug}/
        </span>
        <span className="font-mono text-[10px] text-muted-foreground tracking-normal">
          {step.index} / {String(anatomySteps.length).padStart(2, '0')}
        </span>
      </div>
      <div className="flex items-center gap-2 border-border border-b bg-muted px-5 py-2.5">
        <Icon className="size-3.5 text-brand" />
        <span className="font-mono text-foreground text-xs">{fileName}</span>
        <span className="swiss-label ml-auto text-muted-foreground">
          {ownerLabel[step.owner]}
        </span>
      </div>
      <div className="min-h-[12rem] px-5 py-5">
        <CodeLines code={step.code} />
      </div>
    </div>
  )
}

function StepBlock({
  step,
  active,
  registerRef,
}: {
  step: AnatomyStep
  active: boolean
  registerRef: (el: HTMLLIElement | null) => void
}) {
  return (
    <li
      className={cn(
        'ease border-border border-t py-10 transition-opacity duration-300 first:border-t-0 lg:flex lg:min-h-[24vh] lg:flex-col lg:justify-center lg:border-t-0 lg:py-0',
        active ? 'lg:opacity-100' : 'lg:opacity-35'
      )}
      ref={registerRef}
    >
      <div className="flex flex-wrap items-center gap-3">
        <span
          className={cn(
            'ease grid size-7 shrink-0 place-items-center border font-mono text-xs tabular-nums transition-colors duration-300',
            active
              ? 'border-foreground bg-foreground text-background'
              : 'border-border text-muted-foreground'
          )}
        >
          {step.index}
        </span>
        <h3 className="font-semibold text-xl tracking-tight md:text-2xl">
          {step.title}
        </h3>
        <span className="border border-border bg-muted px-2 py-0.5 font-mono text-[11px] text-muted-foreground tracking-normal">
          {fileNameFor(step)}
        </span>
      </div>
      <p className="mt-4 max-w-md text-muted-foreground leading-relaxed">
        {step.caption}
      </p>
      <div className="mt-5 flex items-center gap-2">
        <span className="swiss-label text-muted-foreground">runs in</span>
        <span className="border border-border bg-background px-2 py-0.5 font-mono text-[11px] text-foreground tracking-normal">
          Vercel Sandbox
        </span>
      </div>

      <div className="mt-6 lg:hidden">
        <CodePanel step={step} />
      </div>
    </li>
  )
}

export function LandingAgentAnatomy({
  shouldReduceMotion,
}: {
  shouldReduceMotion: boolean
}) {
  const stepEls = useRef<(HTMLLIElement | null)[]>([])
  const [active, setActive] = useState(0)
  const { scrollY } = useScroll()

  useMotionValueEvent(scrollY, 'change', () => {
    const targetY = window.innerHeight * ACTIVE_LINE_RATIO
    let next = 0
    stepEls.current.forEach((el, index) => {
      if (el && el.getBoundingClientRect().top <= targetY) {
        next = index
      }
    })
    setActive((prev) => (prev === next ? prev : next))
  })

  const activeStep = anatomySteps[active] ?? anatomySteps[0]

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
              <h2 className="mt-4 text-balance font-semibold text-4xl leading-[1.05] tracking-tight md:text-5xl">
                An agent is a directory.
              </h2>
            </div>
            <p className="max-w-2xl text-lg text-muted-foreground leading-relaxed">
              Nine canonical markdown files in a sandbox, each with a job. Some
              you author; the rest it keeps current itself. Scroll the folder.
            </p>
          </motion.div>

          <div className="mt-14 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16">
            <ol>
              {anatomySteps.map((step, index) => (
                <StepBlock
                  active={index === active}
                  key={step.id}
                  registerRef={(el) => {
                    stepEls.current[index] = el
                  }}
                  step={step}
                />
              ))}
            </ol>

            <div className="hidden lg:block">
              <div className="sticky top-24">
                <CodePanel step={activeStep} />
              </div>
            </div>
          </div>
        </motion.div>
      </LazyMotion>
    </section>
  )
}
