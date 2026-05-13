'use client'

import {
  BrainIcon,
  GitBranchIcon,
  HammerIcon,
  RadioTowerIcon,
} from 'lucide-react'
import {
  type MotionValue,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useScroll,
  useTransform,
} from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  revealVariants,
  staggerVariants,
} from '@/marketing/components/landing/landing-motion'

type StageId = 'tools' | 'subagents' | 'channels' | 'memory'
type Corner = 'ne' | 'nw' | 'se' | 'sw'

interface ComposabilityPart {
  id: string
  label: string
}

interface ComposabilityStage {
  caption: string
  corner: Corner
  eyebrow: string
  id: StageId
  label: string
  parts: readonly ComposabilityPart[]
}

const composabilityStages: readonly ComposabilityStage[] = [
  {
    caption:
      'Typed contracts. Rate-limited. Scoped per agent. The agent only calls what you bound.',
    corner: 'ne',
    eyebrow: '01 / 04',
    id: 'tools',
    label: 'Tools',
    parts: [
      { id: 'tool-slack', label: 'slack.search_threads' },
      { id: 'tool-gmail', label: 'gmail.draft' },
      { id: 'tool-cal', label: 'cal.create_event' },
    ],
  },
  {
    caption:
      'Delegate work. Each call is a traced run on its own. The parent waits or fires-and-forgets.',
    corner: 'nw',
    eyebrow: '02 / 04',
    id: 'subagents',
    label: 'Sub-agents',
    parts: [
      { id: 'sub-research', label: 'research-synthesizer' },
      { id: 'sub-digester', label: 'weekly-digester' },
    ],
  },
  {
    caption:
      'Where the agent listens and speaks. Slack DMs, email threads, webhook intake — bound, not guessed.',
    corner: 'se',
    eyebrow: '03 / 04',
    id: 'channels',
    label: 'Channels',
    parts: [
      { id: 'channel-slack', label: 'slack:@you' },
      { id: 'channel-email', label: 'email:inbound' },
    ],
  },
  {
    caption:
      'One markdown file per agent. The agent appends its own notes. You read them anytime.',
    corner: 'sw',
    eyebrow: '04 / 04',
    id: 'memory',
    label: 'Memory',
    parts: [{ id: 'memory-dreams', label: 'DREAMS.md · 47 entries' }],
  },
]

const stageIcons: Record<StageId, typeof HammerIcon> = {
  channels: RadioTowerIcon,
  memory: BrainIcon,
  subagents: GitBranchIcon,
  tools: HammerIcon,
}

const cornerStart: Record<Corner, { left: number; top: number }> = {
  ne: { left: 86, top: 14 },
  nw: { left: 14, top: 14 },
  se: { left: 86, top: 86 },
  sw: { left: 14, top: 86 },
}

const centerTarget = { left: 50, top: 50 }

const cornerLabels: Record<Corner, string> = {
  ne: 'top-right',
  nw: 'top-left',
  se: 'bottom-right',
  sw: 'bottom-left',
}

const stageCount = composabilityStages.length
const totalParts = composabilityStages.reduce(
  (sum, stage) => sum + stage.parts.length,
  0
)

interface PartProgressMeta {
  partIndex: number
  stageEnd: number
  stageIndex: number
  stageStart: number
}

const partProgressMeta = new Map<string, PartProgressMeta>()
composabilityStages.forEach((stage, stageIndex) => {
  const stageSlice = 1 / stageCount
  const stageStart = stageIndex * stageSlice
  stage.parts.forEach((part, partIndex) => {
    const partSlice = stageSlice / stage.parts.length
    const start = stageStart + partIndex * partSlice
    const end = start + partSlice
    partProgressMeta.set(part.id, {
      partIndex,
      stageEnd: end,
      stageIndex,
      stageStart: start,
    })
  })
})

function stageSlotCounts(activeIndex: number) {
  return composabilityStages.map((stage, index) =>
    index <= activeIndex ? stage.parts.length : 0
  )
}

function mostVisibleStageIndex(stageVisibility: ReadonlyMap<number, number>) {
  let nextIndex = 0
  let bestRatio = 0

  for (const [index, ratio] of stageVisibility.entries()) {
    if (ratio > bestRatio) {
      bestRatio = ratio
      nextIndex = index
    }
  }

  return bestRatio > 0 ? nextIndex : null
}

function mobileMarkerTone(isActive: boolean, isAttached: boolean) {
  if (isActive) {
    return 'bg-foreground text-background'
  }
  if (isAttached) {
    return 'bg-accent/35'
  }
  return 'bg-background'
}

function mobileStageSurfaceTone(active: boolean, attached: boolean) {
  if (active) {
    return 'bg-accent/25'
  }
  if (attached) {
    return 'bg-muted'
  }
  return 'bg-background'
}

function mobileStageStatus(active: boolean, attached: boolean) {
  if (active) {
    return 'Attaching now'
  }
  if (attached) {
    return 'Attached'
  }
  return 'Queued'
}

function clamp01(value: number) {
  if (value < 0) {
    return 0
  }
  if (value > 1) {
    return 1
  }
  return value
}

function partSnapProgress(partId: string, sectionProgress: number) {
  const meta = partProgressMeta.get(partId)
  if (!meta) {
    return 0
  }
  return clamp01(
    (sectionProgress - meta.stageStart) / (meta.stageEnd - meta.stageStart)
  )
}

const LG_BREAKPOINT_PX = 1024

function useIsDesktopViewport() {
  const [isDesktop, setIsDesktop] = useState<boolean | undefined>(undefined)

  useEffect(() => {
    const mql = window.matchMedia(`(min-width: ${LG_BREAKPOINT_PX}px)`)
    const update = () => setIsDesktop(mql.matches)
    update()
    mql.addEventListener('change', update)
    return () => mql.removeEventListener('change', update)
  }, [])

  return isDesktop
}

export function LandingComposableWorkbench({
  shouldReduceMotion,
}: {
  shouldReduceMotion: boolean
}) {
  const isDesktop = useIsDesktopViewport()

  return (
    <section
      className="px-4 py-20 sm:px-6 md:px-10 md:py-28 lg:px-12"
      id="workbench"
    >
      <motion.div
        className="mx-auto max-w-7xl"
        initial={shouldReduceMotion ? false : 'hidden'}
        variants={staggerVariants}
        viewport={{ once: true, margin: '-80px' }}
        whileInView="visible"
      >
        <motion.div
          className="grid gap-5 border-foreground border-t-4 pt-5 md:grid-cols-[minmax(0,0.82fr)_minmax(0,1fr)] md:items-end"
          variants={revealVariants}
        >
          <div>
            <p className="swiss-label text-accent">Anatomy of an agent</p>
            <h2 className="mt-4 text-balance font-black text-5xl uppercase leading-[0.88] tracking-normal md:text-7xl">
              An agent is what you attach to it.
            </h2>
          </div>
          <p className="max-w-2xl text-muted-foreground leading-relaxed">
            The agent is a shell. Capabilities snap into named slots. You see
            what's attached, what ran, what changed.
          </p>
        </motion.div>
      </motion.div>

      {(() => {
        if (shouldReduceMotion || isDesktop === undefined) {
          return <ComposabilityStacked />
        }
        return isDesktop ? (
          <ComposabilityPinned />
        ) : (
          <ComposabilityMobileStory />
        )
      })()}
    </section>
  )
}

function ComposabilityPinned() {
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

interface MobileVisualSize {
  height: number
  width: number
}

function ComposabilityMobileStory() {
  const [activeIndex, setActiveIndex] = useState(0)
  const [visualSize, setVisualSize] = useState<MobileVisualSize>({
    height: 272,
    width: 320,
  })
  const stageRefs = useRef<Array<HTMLElement | null>>([])
  const visualRef = useRef<HTMLDivElement>(null)
  const stickyRef = useRef<HTMLDivElement>(null)
  const activeStage = composabilityStages[activeIndex] ?? composabilityStages[0]
  const slotCounts = stageSlotCounts(activeIndex)
  const attached = slotCounts.reduce((sum, count) => sum + count, 0)

  useEffect(() => {
    const visual = visualRef.current
    if (!visual) {
      return
    }

    const updateSize = () => {
      setVisualSize({
        height: visual.clientHeight || 272,
        width: visual.clientWidth || 320,
      })
    }

    updateSize()

    if (typeof ResizeObserver === 'undefined') {
      return
    }

    const observer = new ResizeObserver(() => {
      updateSize()
    })
    observer.observe(visual)

    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') {
      return
    }

    const stageVisibility = new Map<number, number>()
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const index = Number((entry.target as HTMLElement).dataset.stageIndex)
          if (Number.isNaN(index)) {
            continue
          }
          stageVisibility.set(
            index,
            entry.isIntersecting ? entry.intersectionRatio : 0
          )
        }

        const nextIndex = mostVisibleStageIndex(stageVisibility)
        if (nextIndex !== null) {
          setActiveIndex((currentIndex) =>
            currentIndex === nextIndex ? currentIndex : nextIndex
          )
        }
      },
      {
        rootMargin: '-42% 0px -28% 0px',
        threshold: [0.25, 0.4, 0.55, 0.7, 0.85],
      }
    )

    for (const [index, node] of stageRefs.current.entries()) {
      if (!node) {
        continue
      }
      stageVisibility.set(index, 0)
      observer.observe(node)
    }

    return () => observer.disconnect()
  }, [])

  return (
    <div className="mx-auto mt-10 max-w-7xl px-0 lg:px-4">
      <div className="grid gap-4">
        <div className="sticky top-4 z-20" ref={stickyRef}>
          <div className="border-2 border-foreground bg-background/95 p-3 shadow-[0_14px_32px_rgb(0_0_0/0.08)] supports-backdrop-filter:bg-background/85 supports-backdrop-filter:backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="swiss-label text-accent">{activeStage.eyebrow}</p>
                <p className="mt-1 font-mono text-[10px] text-muted-foreground uppercase tracking-normal">
                  Scroll to compose
                </p>
              </div>
              <Badge
                className="h-auto border-2 px-2 py-1 font-mono text-[10px] uppercase tracking-normal"
                variant="outline"
              >
                {attached} / {totalParts} attached
              </Badge>
            </div>

            <div className="mt-4 overflow-hidden border-2 border-foreground bg-muted p-3">
              <div className="relative h-68 sm:h-76" ref={visualRef}>
                <div
                  aria-hidden
                  className="swiss-diagonal pointer-events-none absolute inset-0 opacity-30"
                />
                <div className="absolute inset-0">
                  <MobileStageFlight
                    activeIndex={activeIndex}
                    size={visualSize}
                  />
                </div>
                <div className="absolute inset-x-3 top-12 bottom-3 grid place-items-center">
                  <AgentShellCard compact slotCounts={slotCounts} />
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-4 gap-1 font-mono text-[10px] uppercase tracking-normal">
              {composabilityStages.map((stage, index) => {
                const isActive = index === activeIndex
                const isAttached = index < activeIndex

                return (
                  <div
                    className={cn(
                      'border-2 border-foreground p-2',
                      mobileMarkerTone(isActive, isAttached)
                    )}
                    key={stage.id}
                  >
                    <span className="block font-bold">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <span className="mt-1 block truncate font-black text-[11px]">
                      {stage.label}
                    </span>
                  </div>
                )
              })}
            </div>

            <div className="mt-3 h-2 overflow-hidden border-2 border-foreground bg-muted">
              <motion.span
                animate={{ scaleX: (activeIndex + 1) / stageCount }}
                aria-hidden
                className="block h-full origin-left bg-accent"
                initial={false}
                transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>

            <h3 className="mt-4 font-black text-3xl uppercase leading-[0.9] tracking-normal sm:text-4xl">
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

function CaptionRail({
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
    <aside className="border-2 border-foreground bg-background p-6">
      <div className="flex items-center justify-between gap-3">
        <p className="swiss-label text-accent">{activeStage.eyebrow}</p>
        <span className="grid size-12 place-items-center border-2 border-foreground bg-accent">
          <Icon className="size-5" />
        </span>
      </div>

      <h3 className="mt-6 font-black text-5xl uppercase leading-[0.88] tracking-normal md:text-7xl">
        {activeStage.label}
      </h3>

      <p className="mt-6 max-w-md text-muted-foreground leading-relaxed">
        {activeStage.caption}
      </p>

      <div className="mt-8 grid grid-cols-4 gap-1 font-mono text-[10px] uppercase tracking-normal">
        {composabilityStages.map((stage, index) => (
          <div
            className={cn(
              'border-2 border-foreground p-2',
              index === activeIndex
                ? 'bg-foreground text-background'
                : 'bg-background'
            )}
            key={stage.id}
          >
            <span className="block font-bold">
              {String(index + 1).padStart(2, '0')}
            </span>
            <span className="mt-1 block truncate font-black text-[11px]">
              {stage.label}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-6 h-2 overflow-hidden border-2 border-foreground bg-muted">
        <motion.span
          aria-hidden
          className="block h-full origin-left bg-accent"
          style={{ scaleX: progressScaleX }}
        />
      </div>

      <p className="mt-4 font-mono text-[10px] text-muted-foreground uppercase tracking-normal">
        scroll to attach · {attached} / {totalParts} parts attached
      </p>
    </aside>
  )
}

function AssemblyVisual({
  progress,
  slotCounts,
}: {
  progress: number
  slotCounts: readonly number[]
}) {
  return (
    <div className="relative h-full min-h-144 w-full">
      <div
        aria-hidden
        className="swiss-diagonal pointer-events-none absolute inset-0 opacity-40"
      />

      <div className="absolute inset-0">
        {composabilityStages.map((stage) =>
          stage.parts.map((part, partIndex) => (
            <FlyingChip
              corner={stage.corner}
              indexInCluster={partIndex}
              key={part.id}
              part={part}
              snap={partSnapProgress(part.id, progress)}
              stageColor={stage.id === 'memory' ? 'accent' : 'background'}
              total={stage.parts.length}
            />
          ))
        )}
      </div>

      <div className="absolute inset-0 grid place-items-center">
        <AgentShellCard slotCounts={slotCounts} />
      </div>
    </div>
  )
}

function MobileStageFlight({
  activeIndex,
  size,
}: {
  activeIndex: number
  size: MobileVisualSize
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
                  'block -translate-x-1/2 -translate-y-1/2 border-2 border-foreground px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-normal shadow-[3px_3px_0_0] shadow-foreground/15',
                  stageColor === 'accent'
                    ? 'bg-accent text-foreground'
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

function FlyingChip({
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
        'pointer-events-none absolute z-0 font-mono text-[15px] uppercase tracking-normal transition-opacity duration-150',
        'border-2 border-foreground px-5 py-3 shadow-[5px_5px_0_0] shadow-foreground/15',
        stageColor === 'accent'
          ? 'bg-accent text-foreground'
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

function AgentShellCard({
  compact = false,
  slotCounts,
}: {
  compact?: boolean
  slotCounts: readonly number[]
}) {
  const allFilled = slotCounts.every(
    (count, idx) => count === composabilityStages[idx].parts.length
  )

  return (
    <div
      className={cn(
        'relative z-10 w-full border-2 border-foreground bg-background shadow-foreground/25',
        compact
          ? 'max-w-[18rem] p-1.5 shadow-[6px_6px_0_0] sm:max-w-76'
          : 'max-w-md p-2 shadow-[8px_8px_0_0]'
      )}
    >
      <div
        className={cn(
          'border border-foreground/15 bg-background',
          compact ? 'p-4' : 'p-5'
        )}
      >
        <div
          className={cn(
            'flex items-start justify-between gap-3 border-foreground border-b-2',
            compact ? 'pb-3' : 'pb-4'
          )}
        >
          <div>
            <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-normal">
              Agent
            </p>
            <p
              className={cn(
                'mt-2 font-black uppercase leading-none tracking-normal',
                compact ? 'text-lg' : 'text-2xl'
              )}
            >
              INBOX SENTINEL
            </p>
          </div>
          <Badge
            className={cn(
              compact &&
                'h-auto px-2 py-1 font-mono text-[9px] uppercase tracking-normal'
            )}
            variant="outline"
          >
            {allFilled ? 'composed' : 'incomplete'}
          </Badge>
        </div>

        <div className={cn('mt-4 grid', compact ? 'gap-1.5' : 'gap-2')}>
          {composabilityStages.map((stage, idx) => {
            const count = slotCounts[idx] ?? 0
            const total = stage.parts.length
            const filled = count >= total
            const Icon = stageIcons[stage.id]
            return (
              <div
                className={cn(
                  'grid items-center border-2 border-foreground transition-colors duration-150',
                  compact
                    ? 'grid-cols-[1.25rem_minmax(0,1fr)_auto] gap-2 px-2.5 py-2'
                    : 'grid-cols-[1.75rem_minmax(0,1fr)_auto] gap-3 px-3 py-3',
                  filled ? 'bg-foreground text-background' : 'bg-muted'
                )}
                key={stage.id}
              >
                <Icon className={compact ? 'size-3.5' : 'size-4'} />
                <p
                  className={cn(
                    'font-black uppercase tracking-normal',
                    compact ? 'text-[11px] leading-tight' : 'text-sm'
                  )}
                >
                  {stage.label}
                </p>
                <p
                  className={cn(
                    'font-mono tabular-nums',
                    compact ? 'text-[10px]' : 'text-xs',
                    filled ? 'text-background/80' : 'text-muted-foreground'
                  )}
                >
                  {count} / {total}
                </p>
              </div>
            )
          })}
        </div>

        <p
          className={cn(
            'border-foreground border-t-2 font-mono text-muted-foreground uppercase tracking-normal',
            compact ? 'mt-3 pt-2 text-[9px]' : 'mt-4 pt-3 text-[10px]'
          )}
        >
          {allFilled
            ? 'Eight parts. One agent. Yours.'
            : 'Waiting for parts to attach…'}
        </p>
      </div>
    </div>
  )
}

function MobileStageCard({
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
  stickyRef: React.RefObject<HTMLDivElement | null>
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
        'scroll-mt-24 border-2 border-foreground p-2 transition-colors duration-200 will-change-transform',
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
            ? 'border-foreground bg-background'
            : 'border-foreground/15 bg-background'
        )}
      >
        <div className="flex items-start justify-between gap-3 border-foreground border-b-2 pb-4">
          <div>
            <p className="swiss-label text-accent">{stage.eyebrow}</p>
            <h3 className="mt-3 font-black text-3xl uppercase leading-none tracking-normal">
              {stage.label}
            </h3>
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className="grid size-11 place-items-center border-2 border-foreground bg-accent">
              <Icon className="size-5" />
            </span>
            <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-normal">
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
                'border-2 border-foreground px-3 py-2 font-mono text-[11px] uppercase tracking-normal',
                active || attached ? 'bg-background' : 'bg-muted'
              )}
              key={part.id}
            >
              {part.label}
            </span>
          ))}
        </div>

        <p className="mt-4 font-mono text-[10px] text-muted-foreground uppercase tracking-normal">
          Attaches to {cornerLabels[stage.corner]} slot of the agent shell.
        </p>
      </div>
    </motion.article>
  )
}

function ComposabilityStacked() {
  return (
    <div className="mx-auto mt-10 grid max-w-7xl gap-6 lg:grid-cols-2">
      {composabilityStages.map((stage) => {
        const Icon = stageIcons[stage.id]
        return (
          <article
            className="border-2 border-foreground bg-background p-2"
            key={stage.id}
          >
            <div className="border border-foreground/15 bg-muted p-5">
              <div className="flex items-start justify-between gap-3 border-foreground border-b-2 pb-4">
                <div>
                  <p className="swiss-label text-accent">{stage.eyebrow}</p>
                  <h3 className="mt-3 font-black text-4xl uppercase leading-none tracking-normal md:text-5xl">
                    {stage.label}
                  </h3>
                </div>
                <span className="grid size-12 place-items-center border-2 border-foreground bg-accent">
                  <Icon className="size-5" />
                </span>
              </div>

              <p className="mt-4 text-muted-foreground text-sm leading-relaxed">
                {stage.caption}
              </p>

              <div className="mt-5 grid gap-2">
                {stage.parts.map((part) => (
                  <span
                    className="border-2 border-foreground bg-background px-3 py-2 font-mono text-[11px] uppercase tracking-normal"
                    key={part.id}
                  >
                    {part.label}
                  </span>
                ))}
              </div>

              <p className="mt-4 font-mono text-[10px] text-muted-foreground uppercase tracking-normal">
                Attaches to {cornerLabels[stage.corner]} slot of the agent
                shell.
              </p>
            </div>
          </article>
        )
      })}
    </div>
  )
}
