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
import { useRef, useState } from 'react'
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

export function LandingComposableWorkbench({
  shouldReduceMotion,
}: {
  shouldReduceMotion: boolean
}) {
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

      {shouldReduceMotion ? (
        <ComposabilityStacked />
      ) : (
        <>
          <div className="lg:hidden">
            <ComposabilityStacked />
          </div>
          <div className="hidden lg:block">
            <ComposabilityPinned />
          </div>
        </>
      )}
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
    <div className="relative h-full min-h-[36rem] w-full">
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
        'pointer-events-none absolute z-0 font-mono text-[11px] uppercase tracking-normal transition-opacity duration-150',
        'border-2 border-foreground px-3 py-2 shadow-[4px_4px_0_0] shadow-foreground/15',
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

function AgentShellCard({ slotCounts }: { slotCounts: readonly number[] }) {
  const allFilled = slotCounts.every(
    (count, idx) => count === composabilityStages[idx].parts.length
  )

  return (
    <div className="relative z-10 w-full max-w-[28rem] border-2 border-foreground bg-background p-2 shadow-[8px_8px_0_0] shadow-foreground/25">
      <div className="border border-foreground/15 bg-background p-5">
        <div className="flex items-start justify-between gap-3 border-foreground border-b-2 pb-4">
          <div>
            <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-normal">
              Agent
            </p>
            <p className="mt-2 font-black text-2xl uppercase leading-none tracking-normal">
              INBOX SENTINEL
            </p>
          </div>
          <Badge variant="outline">
            {allFilled ? 'composed' : 'incomplete'}
          </Badge>
        </div>

        <div className="mt-4 grid gap-2">
          {composabilityStages.map((stage, idx) => {
            const count = slotCounts[idx] ?? 0
            const total = stage.parts.length
            const filled = count >= total
            const Icon = stageIcons[stage.id]
            return (
              <div
                className={cn(
                  'grid grid-cols-[1.75rem_minmax(0,1fr)_auto] items-center gap-3 border-2 border-foreground px-3 py-3 transition-colors duration-150',
                  filled ? 'bg-foreground text-background' : 'bg-muted'
                )}
                key={stage.id}
              >
                <Icon className="size-4" />
                <p className="font-black text-sm uppercase tracking-normal">
                  {stage.label}
                </p>
                <p
                  className={cn(
                    'font-mono text-xs tabular-nums',
                    filled ? 'text-background/80' : 'text-muted-foreground'
                  )}
                >
                  {count} / {total}
                </p>
              </div>
            )
          })}
        </div>

        <p className="mt-4 border-foreground border-t-2 pt-3 font-mono text-[10px] text-muted-foreground uppercase tracking-normal">
          {allFilled
            ? 'Eight parts. One agent. Yours.'
            : 'Waiting for parts to attach…'}
        </p>
      </div>
    </div>
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
