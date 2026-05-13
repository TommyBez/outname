'use client'

import { motion } from 'motion/react'
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
          className="mt-10 grid gap-3 border-2 border-foreground bg-foreground p-3 text-background sm:grid-cols-3"
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

        <motion.ol className="mt-6 grid gap-2" variants={revealVariants}>
          {heartbeatEvents.map((entry) => (
            <HeartbeatRow
              entry={entry}
              key={`${entry.time}-${entry.event}-${entry.detail}`}
            />
          ))}
        </motion.ol>

        <motion.div
          className="mt-12 grid gap-6 border-foreground border-t-2 pt-8 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] md:items-end"
          variants={revealVariants}
        >
          <h3 className="home-display text-balance font-black text-6xl uppercase leading-[0.84] tracking-normal md:text-8xl">
            Stand it up.
          </h3>
          <div className="flex min-w-0 flex-col gap-3 md:items-end">
            <PrimaryLink href="/login?from=/agents/new">
              Create your agent
            </PrimaryLink>
            <p className="font-mono text-[11px] text-muted-foreground uppercase tracking-normal">
              Runs on your Vercel account.
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
