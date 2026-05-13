'use client'

import { motion, useMotionValueEvent, useScroll } from 'motion/react'
import { useRef, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { PrimaryLink } from '@/marketing/components/landing/landing-links'
import {
  revealVariants,
  staggerVariants,
} from '@/marketing/components/landing/landing-motion'

type HeartbeatKind =
  | 'cron'
  | 'slack'
  | 'memory'
  | 'heartbeat'
  | 'cal'
  | 'subagent'
  | 'gmail'

interface HeartbeatEvent {
  detail: string
  emphasis?: 'memory' | 'highlight'
  event: string
  kind: HeartbeatKind
  time: string
}

const heartbeatStats = [
  { label: 'Unprompted runs', value: '21' },
  { label: 'Memory entries written', value: '+8' },
  { label: 'Questions asked', value: '0' },
] as const

const heartbeatEvents: readonly HeartbeatEvent[] = [
  {
    detail: 'daily.triage queued',
    event: 'cron.fire',
    kind: 'cron',
    time: '06:00',
  },
  {
    detail: '14 threads scanned · 2 flagged',
    event: 'slack.read',
    kind: 'slack',
    time: '06:00',
  },
  {
    detail: '+ skip auto-summary on Sundays',
    emphasis: 'memory',
    event: 'memory.write',
    kind: 'memory',
    time: '06:01',
  },
  {
    detail: 'calendar conflict spotted · draft sent',
    event: 'heartbeat',
    kind: 'heartbeat',
    time: '09:14',
  },
  {
    detail: 'tue 15:00 → wed 10:00 proposed',
    event: 'cal.draft',
    kind: 'cal',
    time: '09:14',
  },
  {
    detail: 'research-synthesizer · 4.2s',
    event: 'subagent.call',
    kind: 'subagent',
    time: '11:02',
  },
  {
    detail: '+ user prefers "Tomas" in replies',
    emphasis: 'memory',
    event: 'memory.write',
    kind: 'memory',
    time: '11:02',
  },
  {
    detail: 'weekly.digest queued',
    event: 'cron.fire',
    kind: 'cron',
    time: '14:00',
  },
  {
    detail: '5 threads summarized · digest ready',
    event: 'gmail.draft',
    kind: 'gmail',
    time: '14:01',
  },
  {
    detail: 'weekly digest sent · 0 follow-ups',
    emphasis: 'highlight',
    event: 'gmail.send',
    kind: 'gmail',
    time: '18:00',
  },
]

export function LandingHeartbeatCloser({
  shouldReduceMotion,
}: {
  shouldReduceMotion: boolean
}) {
  return (
    <section
      className="px-4 pt-10 pb-24 sm:px-6 md:px-10 md:pb-32 lg:px-12"
      id="heartbeat"
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
            <p className="swiss-label text-accent">
              One day · INBOX SENTINEL · 2026-05-11
            </p>
            <h2 className="mt-4 text-balance font-black text-5xl uppercase leading-[0.88] tracking-normal md:text-7xl">
              It runs while you sleep. It learns while it runs.
            </h2>
          </div>
          <p className="max-w-xl text-muted-foreground leading-relaxed">
            Schedules fire. Channels light up. Sub-agents return. The memory
            file grows. The agent gets sharper. You read the log in the morning.
          </p>
        </motion.div>

        <motion.div
          className="mt-10 hidden gap-3 border-2 border-foreground bg-foreground p-3 text-background lg:grid lg:grid-cols-3"
          variants={revealVariants}
        >
          {heartbeatStats.map((stat) => (
            <div
              className="min-h-28 border border-background/25 p-4"
              key={stat.label}
            >
              <p className="font-bold text-[10px] text-background/60 uppercase tracking-normal">
                {stat.label}
              </p>
              <p className="mt-3 font-black text-6xl uppercase leading-none tracking-normal">
                {stat.value}
              </p>
            </div>
          ))}
        </motion.div>

        <motion.ol
          className="mt-6 hidden gap-2 lg:grid"
          variants={revealVariants}
        >
          {heartbeatEvents.map((entry) => (
            <HeartbeatRow
              entry={entry}
              key={`${entry.time}-${entry.event}-${entry.detail}`}
            />
          ))}
        </motion.ol>

        <motion.div className="mt-8 lg:hidden" variants={revealVariants}>
          <HeartbeatTerminalPinned />
        </motion.div>

        <motion.div
          className="mt-12 grid gap-6 border-foreground border-t-2 pt-8 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] md:items-end"
          variants={revealVariants}
        >
          <h3 className="home-display text-balance font-black text-6xl uppercase leading-[0.84] tracking-normal md:text-8xl">
            Run yours.
          </h3>
          <div className="flex min-w-0 flex-col gap-3 md:items-end">
            <PrimaryLink href="/login?from=/agents/new">
              Create your agent
            </PrimaryLink>
            <p className="font-mono text-[11px] text-muted-foreground uppercase tracking-normal">
              Smarter every day.
            </p>
          </div>
        </motion.div>
      </motion.div>
    </section>
  )
}

const kindLabel: Record<HeartbeatKind, string> = {
  cal: 'Calendar',
  cron: 'Cron',
  gmail: 'Email',
  heartbeat: 'Heartbeat',
  memory: 'Memory',
  slack: 'Slack',
  subagent: 'Sub-agent',
}

function HeartbeatRow({ entry }: { entry: HeartbeatEvent }) {
  const isMemory = entry.emphasis === 'memory'
  const isHighlight = entry.emphasis === 'highlight'

  return (
    <li
      className={cn(
        'grid items-center gap-3 border-2 border-foreground p-3 font-mono text-xs sm:grid-cols-[4rem_minmax(0,8rem)_minmax(0,1fr)_auto] sm:gap-4',
        isMemory && 'bg-accent',
        isHighlight && 'bg-foreground text-background',
        !(isMemory || isHighlight) && 'bg-background'
      )}
    >
      <span
        className={cn(
          'font-black text-sm uppercase tracking-normal',
          isHighlight ? 'text-background' : ''
        )}
      >
        {entry.time}
      </span>
      <span
        className={cn(
          'truncate font-bold text-[11px] uppercase tracking-normal',
          isMemory ? 'text-foreground' : '',
          isHighlight ? 'text-background/70' : 'text-muted-foreground'
        )}
      >
        {entry.event}
      </span>
      <span
        className={cn(
          'min-w-0 truncate font-mono text-xs',
          isHighlight ? 'text-background' : 'text-foreground'
        )}
      >
        {entry.detail}
      </span>
      <Badge
        className={cn(
          'justify-self-start sm:justify-self-end',
          isMemory && 'border-foreground bg-background text-foreground',
          isHighlight && 'border-background bg-background text-foreground'
        )}
        variant="outline"
      >
        {kindLabel[entry.kind]}
      </Badge>
    </li>
  )
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

function HeartbeatTerminalPinned() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [revealed, setRevealed] = useState(0)
  const { scrollY } = useScroll()

  useMotionValueEvent(scrollY, 'change', () => {
    const node = containerRef.current
    if (!node) {
      return
    }
    const rect = node.getBoundingClientRect()
    const scrollable = Math.max(1, rect.height - window.innerHeight)
    const progress = clamp01(-rect.top / scrollable)
    const next = Math.min(
      heartbeatEvents.length,
      Math.floor(progress * (heartbeatEvents.length + 0.6))
    )
    setRevealed((current) => (current === next ? current : next))
  })

  const visible = heartbeatEvents.slice(0, revealed)
  const memoryCount = visible.filter(
    (entry) => entry.emphasis === 'memory'
  ).length
  const isDone = revealed >= heartbeatEvents.length

  return (
    <div className="relative h-[320vh]" ref={containerRef}>
      <div className="sticky top-6">
        <div className="border-2 border-foreground bg-foreground p-2 text-background shadow-[8px_8px_0_0] shadow-foreground/30">
          <div className="border border-background/15 bg-foreground p-4">
            <div className="flex items-center justify-between gap-3 border-background/25 border-b pb-3 font-mono text-[10px] uppercase tracking-normal">
              <span className="truncate text-background">
                $ outname watch inbox-sentinel
              </span>
              <span className="shrink-0 text-background/60">2026-05-11</span>
            </div>

            <ol className="mt-3 grid gap-2 font-mono text-[11px]">
              {visible.map((entry) => {
                const isMemory = entry.emphasis === 'memory'
                const isHighlight = entry.emphasis === 'highlight'

                return (
                  <motion.li
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      'grid gap-1 border-l-2 px-3 py-2',
                      isMemory && 'border-accent bg-accent/15',
                      isHighlight && 'border-background bg-background/15',
                      !(isMemory || isHighlight) && 'border-background/25'
                    )}
                    initial={{ opacity: 0, y: 6 }}
                    key={`${entry.time}-${entry.event}-${entry.detail}`}
                    transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-black text-[13px] text-background uppercase tabular-nums tracking-normal">
                        {entry.time}
                      </span>
                      <span
                        className={cn(
                          'truncate font-mono text-[10px] uppercase tracking-normal',
                          isMemory ? 'text-accent' : 'text-background/60'
                        )}
                      >
                        {entry.event}
                      </span>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span
                        aria-hidden
                        className={cn(
                          'shrink-0',
                          isMemory ? 'text-accent' : 'text-background/70'
                        )}
                      >
                        ▸
                      </span>
                      <span className="min-w-0 break-words text-[11px] text-background/90 leading-snug">
                        {entry.detail}
                      </span>
                    </div>
                    {isHighlight ? (
                      <span className="mt-1 self-end font-mono text-[9px] text-background/70 uppercase tracking-normal">
                        ✓ Done
                      </span>
                    ) : null}
                  </motion.li>
                )
              })}

              {revealed > 0 ? (
                <li className="flex items-center gap-2 px-3 pt-1 font-mono text-[11px]">
                  <span
                    aria-hidden
                    className="inline-block h-[0.95em] w-[0.55em] animate-pulse bg-accent align-middle"
                  />
                  <span className="text-background/60 uppercase tracking-normal">
                    {isDone ? 'idle.' : 'streaming…'}
                  </span>
                </li>
              ) : (
                <li className="flex items-center gap-2 px-3 pt-1 font-mono text-[11px] text-background/40 uppercase tracking-normal">
                  Scroll to watch the day
                </li>
              )}
            </ol>

            <div className="mt-4 grid grid-cols-3 gap-2 border-background/25 border-t pt-3 font-mono text-[10px] text-background/60 uppercase tracking-normal">
              <div>
                <p>Runs</p>
                <p className="mt-1 font-black text-2xl text-background tabular-nums">
                  {revealed.toString().padStart(2, '0')}
                </p>
              </div>
              <div>
                <p>Memory</p>
                <p className="mt-1 font-black text-2xl text-background tabular-nums">
                  +{memoryCount}
                </p>
              </div>
              <div>
                <p>Questions</p>
                <p className="mt-1 font-black text-2xl text-background tabular-nums">
                  00
                </p>
              </div>
            </div>
          </div>
        </div>

        <p className="mt-3 font-mono text-[10px] text-muted-foreground uppercase tracking-normal">
          scroll to advance · {revealed} / {heartbeatEvents.length} events
        </p>
      </div>
    </div>
  )
}
