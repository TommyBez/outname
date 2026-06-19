'use client'

import { composabilityStages } from '@outname/shared/marketing/data/composability-demo'
import { cn } from '@outname/ui/lib/utils'
import { m as motion } from 'motion/react'
import { centerTarget, cornerStart } from './constants'
import type { ElementSize } from './use-element-size'

export function MobileStageFlight({
  activeIndex,
  size,
}: {
  activeIndex: number
  size: ElementSize
}) {
  const activeStage = composabilityStages[activeIndex] ?? composabilityStages[0]
  const width = size.width || 320
  const height = size.height || 272

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0"
      key={activeStage.id}
    >
      {activeStage.parts.map((part, partIndex) => {
        const start = cornerStart[activeStage.corner]
        const spread =
          activeStage.parts.length > 1
            ? partIndex - (activeStage.parts.length - 1) / 2
            : 0
        const axisX =
          activeStage.corner === 'ne' || activeStage.corner === 'se' ? -1 : 1
        const axisY =
          activeStage.corner === 'sw' || activeStage.corner === 'se' ? -1 : 1
        const startLeft = start.left + spread * 6 * axisX
        const startTop = start.top + spread * 6 * axisY
        const deltaX = ((centerTarget.left - startLeft) / 100) * width
        const deltaY = ((centerTarget.top - startTop) / 100) * height
        const stageColor = activeStage.id === 'memory' ? 'accent' : 'background'

        return (
          <span
            className="absolute"
            key={`${activeStage.id}-${part.id}`}
            style={{ left: `${startLeft}%`, top: `${startTop}%` }}
          >
            <motion.span
              animate={{
                opacity: [0, 1, 1, 0],
                scale: [0.96, 1, 0.84, 0.72],
                x: [0, deltaX * 0.58, deltaX, deltaX],
                y: [0, deltaY * 0.58, deltaY, deltaY],
              }}
              className="block will-change-transform"
              initial={{ opacity: 0, scale: 0.96, x: 0, y: 0 }}
              transition={{
                delay: partIndex * 0.08,
                duration: 0.72,
                ease: [0.19, 1, 0.22, 1],
                times: [0, 0.18, 0.72, 1],
              }}
            >
              <span
                className={cn(
                  'block -translate-x-1/2 -translate-y-1/2 border border-border px-2.5 py-1.5 font-mono text-[10px] tracking-normal shadow-[3px_3px_0_0] shadow-foreground/15',
                  stageColor === 'accent'
                    ? 'bg-brand text-brand-foreground'
                    : 'bg-background text-foreground'
                )}
              >
                {part.label}
              </span>
            </motion.span>
          </span>
        )
      })}
    </div>
  )
}
