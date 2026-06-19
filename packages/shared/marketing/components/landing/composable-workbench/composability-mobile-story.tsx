'use client'

import { composabilityStages } from '@outname/shared/marketing/data/composability-demo'
import { Badge } from '@outname/ui/components/ui/badge'
import { cn } from '@outname/ui/lib/utils'
import { m as motion } from 'motion/react'
import { useRef } from 'react'
import { AgentShellCard } from './agent-shell-card'
import {
  mobileMarkerTone,
  stageCount,
  stageSlotCounts,
  totalParts,
} from './constants'
import { MobileStageCard } from './mobile-stage-card'
import { MobileStageFlight } from './mobile-stage-flight'
import { useElementSize } from './use-element-size'
import { useMobileStageActiveIndex } from './use-mobile-stage-active-index'

export function ComposabilityMobileStory() {
  const stageRefs = useRef<Array<HTMLElement | null>>([])
  const visualRef = useRef<HTMLDivElement>(null)
  const stickyRef = useRef<HTMLDivElement>(null)
  const visualSize = useElementSize(visualRef)
  const activeIndex = useMobileStageActiveIndex(stageRefs)
  const activeStage = composabilityStages[activeIndex] ?? composabilityStages[0]
  const slotCounts = stageSlotCounts(activeIndex)
  const attached = slotCounts.reduce((sum, count) => sum + count, 0)

  const size = visualSize ?? { width: 320, height: 272 }

  return (
    <div className="mx-auto mt-10 max-w-7xl px-0 lg:px-4">
      <div className="grid gap-4">
        <div className="sticky top-4 z-20" ref={stickyRef}>
          <div className="border border-border bg-background/95 p-3 shadow-[0_14px_32px_rgb(0_0_0/0.08)] supports-backdrop-filter:bg-background/85 supports-backdrop-filter:backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="swiss-label text-brand">{activeStage.eyebrow}</p>
                <p className="mt-1 font-mono text-[10px] text-muted-foreground tracking-normal">
                  Scroll to compose
                </p>
              </div>
              <Badge
                className="h-auto border px-2 py-1 font-mono text-[10px] tracking-normal"
                variant="outline"
              >
                {attached} / {totalParts} attached
              </Badge>
            </div>

            <div className="mt-4 overflow-hidden border border-border bg-muted p-3">
              <div className="relative h-68 sm:h-76" ref={visualRef}>
                <div className="absolute inset-0">
                  <MobileStageFlight activeIndex={activeIndex} size={size} />
                </div>
                <div className="absolute inset-x-3 top-12 bottom-3 grid place-items-center">
                  <AgentShellCard compact slotCounts={slotCounts} />
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-4 gap-1 font-mono text-[10px] tracking-normal">
              {composabilityStages.map((stage, index) => {
                const isActive = index === activeIndex
                const isAttached = index < activeIndex

                return (
                  <div
                    className={cn(
                      'border border-border p-2',
                      mobileMarkerTone(isActive, isAttached)
                    )}
                    key={stage.id}
                  >
                    <span className="block font-bold">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <span className="mt-1 block truncate font-semibold text-[11px]">
                      {stage.label}
                    </span>
                  </div>
                )
              })}
            </div>

            <div className="mt-3 h-2 overflow-hidden border border-border bg-muted">
              <motion.span
                animate={{ scaleX: (activeIndex + 1) / stageCount }}
                aria-hidden
                className="block h-full origin-left bg-brand"
                initial={false}
                transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>

            <h3 className="mt-4 font-semibold text-3xl leading-[0.9] tracking-normal sm:text-4xl">
              {activeStage.label}
            </h3>
            <p className="mt-3 max-w-xl text-muted-foreground text-sm leading-relaxed">
              {activeStage.caption}
            </p>
          </div>
        </div>

        <div className="grid gap-4">
          {composabilityStages.map((stage, index) => (
            <MobileStageCard
              active={index === activeIndex}
              attached={index <= activeIndex}
              key={stage.id}
              setRef={(node) => {
                stageRefs.current[index] = node
              }}
              stage={stage}
              stageIndex={index}
              stickyRef={stickyRef}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
