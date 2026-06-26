'use client'

import {
  revealVariants,
  staggerVariants,
} from '@outname/shared/marketing/components/landing/landing-motion'
import { cn } from '@outname/ui/lib/utils'
import {
  ActivityIcon,
  BoxIcon,
  type LucideIcon,
  RadioTowerIcon,
} from 'lucide-react'
import { domAnimation, LazyMotion, m as motion } from 'motion/react'
import type { ReactNode } from 'react'

// Durable execution: the phases a single autonomous run checkpoints through.
const runPhases = [
  { fill: 1, label: 'load memory', state: 'done' },
  { fill: 1, label: 'scan channels', state: 'done' },
  { fill: 0.66, label: 'call sub-agent', state: 'running' },
  { fill: 0.2, label: 'write memory', state: 'queued' },
  { fill: 0, label: 'append log', state: 'queued' },
] as const

// Sandboxed compute: recent agent events with their real status vocabulary.
const computeRuns = [
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

// Every surface: real channels (highlighted) and connectors.
const surfaces = [
  'in-app chat',
  'Slack',
  'GitHub',
  'Cal.com',
  'Resend',
  'Firecrawl',
  'PostHog',
  'X',
  'Supabase',
  'Vercel',
] as const

interface Pillar {
  icon: LucideIcon
  id: string
  text: string
  title: string
}

const pillars: readonly Pillar[] = [
  {
    icon: ActivityIcon,
    id: 'durable',
    text: 'Runs survive crashes and restarts. Every step is an event-driven Vercel Workflow, checkpointed and resumable.',
    title: 'Durable execution',
  },
  {
    icon: BoxIcon,
    id: 'sandbox',
    text: 'Each agent owns a persistent Vercel Sandbox — isolated filesystem and execution. Every run is a traced agent event.',
    title: 'Sandboxed compute',
  },
  {
    icon: RadioTowerIcon,
    id: 'surface',
    text: 'One agent answers in-app and in Slack, wired to typed connectors. Budgets and step limits keep it bounded.',
    title: 'Every surface',
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

function ComputeMock() {
  return (
    <ul className="grid gap-2">
      {computeRuns.map((run) => (
        <li
          className="flex items-center justify-between gap-3 border border-border bg-background px-3 py-2.5 font-mono text-[11px] tracking-normal"
          key={run.id}
        >
          <span className="flex min-w-0 items-center gap-2">
            <span
              className={cn(
                'size-2 shrink-0 rounded-full',
                statusTone[run.status]
              )}
            />
            <span className="truncate text-foreground">{run.id}</span>
          </span>
          <span className="shrink-0 text-muted-foreground">{run.meta}</span>
        </li>
      ))}
    </ul>
  )
}

function SurfaceMock() {
  return (
    <ul className="flex flex-wrap gap-2">
      {surfaces.map((surface, index) => (
        <li key={surface}>
          <span
            className={cn(
              'border border-border px-2.5 py-1 font-mono text-[11px] tracking-normal',
              index < 2
                ? 'bg-foreground text-background'
                : 'bg-background text-muted-foreground'
            )}
          >
            {surface}
          </span>
        </li>
      ))}
    </ul>
  )
}

const mocks: Record<string, () => ReactNode> = {
  durable: DurableMock,
  sandbox: ComputeMock,
  surface: SurfaceMock,
}

export function LandingProduction({
  shouldReduceMotion,
}: {
  shouldReduceMotion: boolean
}) {
  return (
    <section
      className="px-4 py-20 sm:px-6 md:px-10 md:py-28 lg:px-12"
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
              Governance, observability, and sandboxed compute come standard.
              Focus on what the agent does, not the infrastructure under it.
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
