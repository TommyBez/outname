'use client'

import {
  anatomyStepCount,
  anatomySteps,
} from '@outname/shared/marketing/data/agent-anatomy'
import {
  AnimatePresence,
  m as motion,
  useMotionValue,
  useMotionValueEvent,
  useScroll,
  useTransform,
} from 'motion/react'
import { useRef, useState } from 'react'
import { AgentFileTree } from './agent-file-tree'
import { AnatomyStepDetail } from './anatomy-step-detail'

const SCROLL_HEIGHT_VH = anatomyStepCount * 80

function clamp01(value: number) {
  if (value < 0) {
    return 0
  }
  if (value > 1) {
    return 1
  }
  return value
}

export function AnatomyPinned() {
  const scrollTargetRef = useRef<HTMLDivElement>(null)
  const sectionProgress = useMotionValue(0)
  const progressScaleX = useTransform(sectionProgress, [0, 1], [0, 1])
  const [activeIndex, setActiveIndex] = useState(0)
  const { scrollY } = useScroll()

  useMotionValueEvent(scrollY, 'change', () => {
    const target = scrollTargetRef.current
    if (!target) {
      return
    }
    const rect = target.getBoundingClientRect()
    const scrollableDistance = Math.max(1, rect.height - window.innerHeight)
    const next = clamp01(-rect.top / scrollableDistance)
    sectionProgress.set(next)
    const nextIndex = Math.min(
      anatomyStepCount - 1,
      Math.max(0, Math.floor(next * anatomyStepCount))
    )
    setActiveIndex((current) => (current === nextIndex ? current : nextIndex))
  })

  const activeStep = anatomySteps[activeIndex]

  return (
    <div className="mx-auto mt-10 max-w-7xl px-0 lg:px-4">
      <div
        className="relative"
        ref={scrollTargetRef}
        style={{ height: `${SCROLL_HEIGHT_VH}vh` }}
      >
        <div className="sticky top-0 grid h-screen grid-cols-[minmax(18rem,0.55fr)_minmax(0,1fr)] items-center gap-8 px-2">
          <div className="flex flex-col gap-4">
            <AgentFileTree activeStepId={activeStep.id} />
            <div className="h-1.5 overflow-hidden border border-border bg-muted">
              <motion.span
                aria-hidden
                className="block h-full origin-left bg-brand"
                style={{ scaleX: progressScaleX }}
              />
            </div>
            <p className="font-mono text-[10px] text-muted-foreground tracking-normal">
              scroll to read · {activeIndex + 1} / {anatomyStepCount}
            </p>
          </div>

          <div className="relative min-h-[28rem] border border-border bg-background p-8 lg:p-10">
            <AnimatePresence initial={false} mode="wait">
              <motion.div
                animate={{ opacity: 1, y: 0 }}
                className="h-full"
                exit={{ opacity: 0, y: -8 }}
                initial={{ opacity: 0, y: 8 }}
                key={activeStep.id}
                transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              >
                <AnatomyStepDetail step={activeStep} total={anatomyStepCount} />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  )
}
