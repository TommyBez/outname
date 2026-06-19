'use client'

import type { ComposabilityStage } from '@outname/shared/marketing/data/composability-demo'
import { cn } from '@outname/ui/lib/utils'
import {
  m as motion,
  useMotionValue,
  useMotionValueEvent,
  useScroll,
} from 'motion/react'
import { type RefObject, useRef } from 'react'
import {
  cornerLabels,
  mobileStageStatus,
  mobileStageSurfaceTone,
  stageIcons,
} from './constants'
import { clamp01 } from './utils'

export function MobileStageCard({
  active,
  attached,
  setRef,
  stage,
  stageIndex,
  stickyRef,
}: {
  active: boolean
  attached: boolean
  setRef: (node: HTMLElement | null) => void
  stage: ComposabilityStage
  stageIndex: number
  stickyRef: RefObject<HTMLDivElement | null>
}) {
  const Icon = stageIcons[stage.id]
  const articleRef = useRef<HTMLElement | null>(null)
  const opacity = useMotionValue(1)
  const scale = useMotionValue(1)
  const { scrollY } = useScroll()

  useMotionValueEvent(scrollY, 'change', () => {
    const node = articleRef.current
    const sticky = stickyRef.current
    if (!(node && sticky)) {
      return
    }
    const cardTop = node.getBoundingClientRect().top
    const stickyBottom = sticky.getBoundingClientRect().bottom
    const fadeStart = -180
    const fadeEnd = -60
    const diff = cardTop - stickyBottom
    const next = clamp01((diff - fadeStart) / (fadeEnd - fadeStart))
    opacity.set(next)
    scale.set(0.94 + next * 0.06)
  })

  const assignRef = (node: HTMLElement | null) => {
    articleRef.current = node
    setRef(node)
  }

  return (
    <motion.article
      aria-current={active ? 'step' : undefined}
      className={cn(
        'scroll-mt-24 border border-border p-2 transition-colors duration-200 will-change-transform',
        mobileStageSurfaceTone(active, attached)
      )}
      data-stage-index={stageIndex}
      ref={assignRef}
      style={{ opacity, scale }}
    >
      <div
        className={cn(
          'border p-5',
          active
            ? 'border-border bg-background'
            : 'border-border/15 bg-background'
        )}
      >
        <div className="flex items-start justify-between gap-3 border-border border-b pb-4">
          <div>
            <p className="swiss-label text-muted-foreground">{stage.eyebrow}</p>
            <h3 className="mt-3 font-semibold text-2xl leading-tight tracking-tight">
              {stage.label}
            </h3>
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className="grid size-11 place-items-center border border-border bg-brand">
              <Icon className="size-5" />
            </span>
            <span className="font-mono text-[10px] text-muted-foreground tracking-normal">
              {mobileStageStatus(active, attached)}
            </span>
          </div>
        </div>

        <p className="mt-4 text-muted-foreground text-sm leading-relaxed">
          {stage.caption}
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          {stage.parts.map((part) => (
            <span
              className={cn(
                'border border-border px-3 py-2 font-mono text-[11px] tracking-normal',
                active || attached ? 'bg-background' : 'bg-muted'
              )}
              key={part.id}
            >
              {part.label}
            </span>
          ))}
        </div>

        <p className="mt-4 font-mono text-[10px] text-muted-foreground tracking-normal">
          Attaches to {cornerLabels[stage.corner]} slot of the agent shell.
        </p>
      </div>
    </motion.article>
  )
}
