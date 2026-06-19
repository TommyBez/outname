'use client'

import { composabilityStages } from '@outname/shared/marketing/data/composability-demo'
import { cn } from '@outname/ui/lib/utils'
import { type MotionValue, m as motion } from 'motion/react'
import { stageIcons, totalParts } from './constants'

export function CaptionRail({
  activeIndex,
  progressScaleX,
  slotCounts,
}: {
  activeIndex: number
  progressScaleX: MotionValue<number>
  slotCounts: readonly number[]
}) {
  const attached = slotCounts.reduce((sum, count) => sum + count, 0)
  const activeStage = composabilityStages[activeIndex]
  const Icon = stageIcons[activeStage.id]

  return (
    <aside className="border border-border bg-background p-6">
      <div className="flex items-center justify-between gap-3">
        <p className="swiss-label text-brand">{activeStage.eyebrow}</p>
        <span className="grid size-12 place-items-center border border-border bg-brand">
          <Icon className="size-5" />
        </span>
      </div>

      <h3 className="mt-6 font-semibold text-5xl leading-[0.88] tracking-normal md:text-7xl">
        {activeStage.label}
      </h3>

      <p className="mt-6 max-w-md text-muted-foreground leading-relaxed">
        {activeStage.caption}
      </p>

      <div className="mt-8 grid grid-cols-4 gap-1 font-mono text-[10px] tracking-normal">
        {composabilityStages.map((stage, index) => (
          <div
            className={cn(
              'border border-border p-2',
              index === activeIndex
                ? 'bg-foreground text-background'
                : 'bg-background'
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
        ))}
      </div>

      <div className="mt-6 h-2 overflow-hidden border border-border bg-muted">
        <motion.span
          aria-hidden
          className="block h-full origin-left bg-brand"
          style={{ scaleX: progressScaleX }}
        />
      </div>

      <p className="mt-4 font-mono text-[10px] text-muted-foreground tracking-normal">
        scroll to attach · {attached} / {totalParts} parts attached
      </p>
    </aside>
  )
}
