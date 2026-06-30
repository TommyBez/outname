'use client'

import {
  revealVariants,
  staggerVariants,
} from '@outname/shared/marketing/components/landing/landing-motion'
import { cn } from '@outname/ui/lib/utils'
import {
  ActivityIcon,
  GaugeIcon,
  type LucideIcon,
  RefreshCwIcon,
} from 'lucide-react'
import { domAnimation, LazyMotion, m as motion } from 'motion/react'
import type { ReactNode } from 'react'

// Durable execution: the phases a single run checkpoints through, so a crash
// resumes mid-step instead of restarting.
const runPhases = [
  { fill: 1, label: 'load memory', state: 'completed' },
  { fill: 1, label: 'scan channels', state: 'completed' },
  { fill: 0.66, label: 'call sub-agent', state: 'running' },
  { fill: 0.2, label: 'write memory', state: 'queued' },
  { fill: 0, label: 'append log', state: 'queued' },
] as const

// Observability: the Events log — every run is an Event with a real type and
// status from the runtime vocabulary.
const eventLog = [
  { id: 'heartbeat · 06:00', status: 'completed', meta: '4.2s' },
  { id: 'dreaming · 14:01', status: 'completed', meta: '11s' },
  { id: 'invocation · now', status: 'running', meta: 'live' },
  { id: 'heartbeat · 18:00', status: 'queued', meta: '—' },
] as const

const statusTone: Record<string, string> = {
  completed: 'bg-muted-foreground/40',
  queued: 'bg-muted-foreground/25',
  running: 'bg-brand',
}

// Governance: real budget periods (USD spend vs. ceiling) plus the per-run
// step limit.
const budgetRules = [
  { ceiling: '$5.00', fill: 0.48, label: 'daily', spent: '$2.40' },
  { ceiling: '$25.00', fill: 0.47, label: 'weekly', spent: '$11.80' },
  { ceiling: '$100.00', fill: 0.36, label: 'monthly', spent: '$36.00' },
] as const

interface Pillar {
  icon: LucideIcon
  id: string
  text: string
  title: string
}

const pillars: readonly Pillar[] = [
  {
    icon: RefreshCwIcon,
    id: 'durable',
    text: 'A crash or redeploy resumes the run mid-step — no lost work, no double-sends. Every run is an event-driven Vercel Workflow.',
    title: 'Durable execution',
  },
  {
    icon: ActivityIcon,
    id: 'events',
    text: 'Heartbeats, dreaming passes, and sub-agent calls all land in one Events log — type, status, and duration on every run.',
    title: 'Observable by default',
  },
  {
    icon: GaugeIcon,
    id: 'bounded',
    text: 'Per-agent and account-wide budgets in USD, plus a step limit on every run. Estimated and actual cost is tracked per Event.',
    title: 'Bounded spend',
  },
]

function DurableMock() {
  return (
    <ul className="grid gap-3">
      {runPhases.map((phase) => (
        <li className="grid gap-2" key={phase.label}>
          <div className="flex items-center justify-between gap-3 font-mono text-[11px] tracking-normal">
            <span className="text-foreground">{phase.label}</span>
            <span className="text-muted-foreground">{phase.state}</span>
          </div>
          <div className="h-1.5 overflow-hidden bg-muted">
            <div
              className={cn(
                'h-full',
                phase.state === 'running' ? 'bg-brand' : 'bg-foreground'
              )}
              style={{ width: `${phase.fill * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}

function EventsMock() {
  return (
    <ul className="grid gap-3">
      {eventLog.map((event) => (
        <li className="grid gap-2" key={event.id}>
          <div className="flex items-center justify-between gap-3 font-mono text-[11px] tracking-normal">
            <span className="flex min-w-0 items-center gap-2">
              <span
                className={cn(
                  'size-2 shrink-0 rounded-full',
                  statusTone[event.status]
                )}
              />
              <span className="truncate text-foreground">{event.id}</span>
            </span>
            <span className="shrink-0 text-muted-foreground">{event.meta}</span>
          </div>
          <div className="h-px bg-border" />
        </li>
      ))}
    </ul>
  )
}

function BudgetMock() {
  return (
    <div className="grid gap-3">
      <ul className="grid gap-3">
        {budgetRules.map((rule) => (
          <li className="grid gap-2" key={rule.label}>
            <div className="flex items-center justify-between gap-3 font-mono text-[11px] tracking-normal">
              <span className="text-foreground">{rule.label}</span>
              <span className="text-muted-foreground">
                {rule.spent} / {rule.ceiling}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden bg-muted">
              <div
                className="h-full bg-foreground"
                style={{ width: `${rule.fill * 100}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between gap-3 border-border border-t pt-3 font-mono text-[11px] tracking-normal">
        <span className="text-foreground">step limit</span>
        <span className="text-muted-foreground">medium · 40 / run</span>
      </div>
    </div>
  )
}

const mocks: Record<string, () => ReactNode> = {
  bounded: BudgetMock,
  durable: DurableMock,
  events: EventsMock,
}

export function LandingProduction({
  shouldReduceMotion,
}: {
  shouldReduceMotion: boolean
}) {
  return (
    <section
      className="px-4 py-14 sm:px-6 md:px-10 md:py-28 lg:px-12"
      id="production"
    >
      <LazyMotion features={domAnimation}>
        <motion.div
          className="mx-auto max-w-7xl"
          initial={shouldReduceMotion ? false : 'hidden'}
          variants={staggerVariants}
          viewport={{ margin: '-80px', once: true }}
          whileInView="visible"
        >
          <motion.div
            className="grid gap-5 border-border border-t pt-5 md:grid-cols-[minmax(0,0.82fr)_minmax(0,1fr)] md:items-end"
            variants={revealVariants}
          >
            <div>
              <p className="swiss-label text-muted-foreground">
                Production agents
              </p>
              <h2 className="mt-4 text-balance font-semibold text-4xl leading-[1.05] tracking-tight md:text-5xl">
                Everything you need for production agents.
              </h2>
            </div>
            <p className="max-w-2xl text-lg text-muted-foreground leading-relaxed">
              Durability, observability, and governance come standard. Focus on
              what the agent does, not the plumbing that keeps it running.
            </p>
          </motion.div>

          {/* Shared visual panel: three mocks in equal-height cells. */}
          <motion.div
            className="mt-12 grid gap-px border border-border bg-border lg:grid-cols-3"
            variants={revealVariants}
          >
            {pillars.map((pillar) => {
              const Mock = mocks[pillar.id]
              return (
                <div
                  className="flex min-h-[16rem] items-center bg-background p-6"
                  key={pillar.id}
                >
                  <div className="w-full">
                    <Mock />
                  </div>
                </div>
              )
            })}
          </motion.div>

          {/* Aligned text row: one label + description per column. */}
          <motion.div
            className="mt-8 grid gap-8 sm:grid-cols-3"
            variants={revealVariants}
          >
            {pillars.map((pillar) => {
              const Icon = pillar.icon
              return (
                <div key={pillar.id}>
                  <div className="flex items-center gap-2">
                    <Icon className="size-4 text-foreground" />
                    <p className="swiss-label text-muted-foreground">
                      {pillar.title}
                    </p>
                  </div>
                  <p className="mt-3 max-w-xs text-muted-foreground text-sm leading-relaxed">
                    {pillar.text}
                  </p>
                </div>
              )
            })}
          </motion.div>
        </motion.div>
      </LazyMotion>
    </section>
  )
}
