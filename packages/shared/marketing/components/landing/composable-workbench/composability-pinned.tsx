'use client'

import { composabilityStages } from '@outname/shared/marketing/data/composability-demo'
import {
  useMotionValue,
  useMotionValueEvent,
  useScroll,
  useTransform,
} from 'motion/react'
import { useRef, useState } from 'react'
import { AssemblyVisual } from './assembly-visual'
import { CaptionRail } from './caption-rail'
import { stageCount } from './constants'
import { partSnapProgress } from './utils'

export function ComposabilityPinned() {
  const scrollTargetRef = useRef<HTMLDivElement>(null)
  const sectionProgress = useMotionValue(0)
  const [activeIndex, setActiveIndex] = useState(0)
  const [progressSnapshot, setProgressSnapshot] = useState(0)
  const progressScaleX = useTransform(sectionProgress, [0, 1], [0, 1])
  const { scrollY } = useScroll()

  useMotionValueEvent(scrollY, 'change', () => {
    const target = scrollTargetRef.current
    if (!target) {
      return
    }
    const rect = target.getBoundingClientRect()
    const scrollableDistance = Math.max(1, rect.height - window.innerHeight)
    const next = Math.min(1, Math.max(0, -rect.top / scrollableDistance))
    sectionProgress.set(next)
    setProgressSnapshot(next)
    const nextIndex = Math.min(
      stageCount - 1,
      Math.max(0, Math.floor(next * stageCount))
    )
    setActiveIndex((currentIndex) =>
      currentIndex === nextIndex ? currentIndex : nextIndex
    )
  })

  const slotCounts = composabilityStages.map((stage) =>
    stage.parts.reduce(
      (count, part) =>
        partSnapProgress(part.id, progressSnapshot) >= 0.92 ? count + 1 : count,
      0
    )
  )

  return (
    <div className="mx-auto mt-10 max-w-7xl px-0 lg:px-4">
      <div className="relative h-[440vh]" ref={scrollTargetRef}>
        <div className="sticky top-0 grid h-screen grid-cols-[minmax(20rem,0.6fr)_minmax(0,1fr)] items-center gap-8 px-2">
          <CaptionRail
            activeIndex={activeIndex}
            progressScaleX={progressScaleX}
            slotCounts={slotCounts}
          />
          <AssemblyVisual progress={progressSnapshot} slotCounts={slotCounts} />
        </div>
      </div>
    </div>
  )
}
