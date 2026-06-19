'use client'

import type {
  ComposabilityPart,
  Corner,
} from '@outname/shared/marketing/data/composability-demo'
import { cn } from '@outname/ui/lib/utils'
import { centerTarget, cornerStart } from './constants'

export function FlyingChip({
  corner,
  indexInCluster,
  part,
  snap,
  stageColor,
  total,
}: {
  corner: Corner
  indexInCluster: number
  part: ComposabilityPart
  snap: number
  stageColor: 'accent' | 'background'
  total: number
}) {
  const start = cornerStart[corner]
  // Spread chips inside same cluster along the corner-to-center axis so they
  // don't stack on top of each other at the corner. Offset is a percentage of
  // the container, scaled down as chips fly in (so they converge cleanly).
  const spread = total > 1 ? indexInCluster - (total - 1) / 2 : 0
  const axisX = corner === 'ne' || corner === 'se' ? -1 : 1
  const axisY = corner === 'sw' || corner === 'se' ? -1 : 1
  const startLeft = start.left + spread * 6 * axisX
  const startTop = start.top + spread * 6 * axisY

  const left = startLeft + (centerTarget.left - startLeft) * snap
  const top = startTop + (centerTarget.top - startTop) * snap
  const scale = 1 - snap * 0.35
  const isVisible = snap < 0.92

  return (
    <span
      aria-hidden
      className={cn(
        'pointer-events-none absolute z-0 font-mono text-[15px] tracking-normal transition-opacity duration-150',
        'border border-border px-5 py-3 shadow-[5px_5px_0_0] shadow-foreground/15',
        stageColor === 'accent'
          ? 'bg-brand text-brand-foreground'
          : 'bg-background text-foreground',
        isVisible ? 'opacity-100' : 'opacity-0'
      )}
      style={{
        left: `${left}%`,
        top: `${top}%`,
        transform: `translate(-50%, -50%) scale(${scale})`,
        transformOrigin: 'center center',
      }}
    >
      {part.label}
    </span>
  )
}
