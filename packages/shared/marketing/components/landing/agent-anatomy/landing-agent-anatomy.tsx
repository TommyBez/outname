'use client'

import { CodeWindow } from '@outname/shared/marketing/components/landing/code-window'
import {
  revealVariants,
  staggerVariants,
} from '@outname/shared/marketing/components/landing/landing-motion'
import {
  type AnatomyStepId,
  agentTree,
  anatomySteps,
  ownerLabel,
} from '@outname/shared/marketing/data/agent-anatomy'
import { Badge } from '@outname/ui/components/ui/badge'
import { cn } from '@outname/ui/lib/utils'
import {
  AnimatePresence,
  domAnimation,
  LazyMotion,
  m as motion,
} from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { AgentFileTree } from './agent-file-tree'
import { stepIcons } from './constants'

const CYCLE_MS = 2800
const fileNameByNode = new Map(agentTree.map((node) => [node.id, node.label]))

function FileViewer({ activeId }: { activeId: AnatomyStepId }) {
  const step =
    anatomySteps.find((entry) => entry.id === activeId) ?? anatomySteps[0]
  const Icon = stepIcons[step.id]
  const fileName = fileNameByNode.get(step.node) ?? step.node
  const total = String(anatomySteps.length).padStart(2, '0')

  return (
    <div className="min-h-[26rem] lg:min-h-[30rem]">
      <AnimatePresence initial={false} mode="wait">
        <motion.div
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          initial={{ opacity: 0, y: 6 }}
          key={step.id}
          transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
        >
          <CodeWindow
            code={step.code}
            filename={fileName}
            label={`${step.index} / ${total}`}
          />
          <div className="mt-6 flex items-start gap-4">
            <span className="grid size-9 shrink-0 place-items-center border border-border bg-brand text-brand-foreground">
              <Icon className="size-4" />
            </span>
            <div className="min-w-0">
              <h3 className="font-semibold text-xl tracking-tight md:text-2xl">
                {step.title}
              </h3>
              <p className="mt-2 max-w-md text-muted-foreground text-sm leading-relaxed">
                {step.caption}
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
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
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

export function LandingAgentAnatomy({
  shouldReduceMotion,
}: {
  shouldReduceMotion: boolean
}) {
  const [activeId, setActiveId] = useState<AnatomyStepId>(anatomySteps[0].id)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (shouldReduceMotion) {
      return
    }
    timerRef.current = setInterval(() => {
      setActiveId((current) => {
        const index = anatomySteps.findIndex((entry) => entry.id === current)
        return anatomySteps[(index + 1) % anatomySteps.length].id
      })
    }, CYCLE_MS)
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, [shouldReduceMotion])

  const handleSelect = (id: AnatomyStepId) => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    setActiveId(id)
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
                The mental model
              </p>
              <h2 className="mt-4 text-balance font-semibold text-3xl leading-tight tracking-tight md:text-4xl">
                An agent is a directory.
              </h2>
            </div>
            <p className="max-w-2xl text-muted-foreground leading-relaxed">
              Nine canonical markdown files in a sandbox, each with a job. Some
              you author; the rest it keeps current itself. Open one.
            </p>
          </motion.div>

          <motion.div
            className="mt-10 grid gap-5 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] lg:items-start"
            variants={revealVariants}
          >
            <AgentFileTree
              activeStepId={activeId}
              onSelectStep={handleSelect}
            />
            <FileViewer activeId={activeId} />
          </motion.div>
        </motion.div>
      </LazyMotion>
    </section>
  )
}
