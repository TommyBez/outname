'use client'

import {
  revealVariants,
  staggerVariants,
} from '@outname/shared/marketing/components/landing/landing-motion'
import {
  ActivityIcon,
  GaugeIcon,
  GitBranchIcon,
  type LucideIcon,
  MoonIcon,
  WalletIcon,
  ZapIcon,
} from 'lucide-react'
import { domAnimation, LazyMotion, m as motion } from 'motion/react'

interface ReadinessCard {
  icon: LucideIcon
  id: string
  text: string
  title: string
}

const readinessCards: readonly ReadinessCard[] = [
  {
    icon: ActivityIcon,
    id: 'events',
    text: 'Every heartbeat, dreaming, and invocation run is a traced agent event you can open and read end to end.',
    title: 'Observable by default',
  },
  {
    icon: ZapIcon,
    id: 'durable',
    text: 'Autonomous turns run as event-driven Vercel Workflows against a per-agent Sandbox — durable, not fire-and-forget.',
    title: 'Durable execution',
  },
  {
    icon: GaugeIcon,
    id: 'steplimits',
    text: 'Cap how hard a single run works — low, medium, high, or grind — so autonomous turns stay bounded.',
    title: 'Step limits',
  },
  {
    icon: WalletIcon,
    id: 'budget',
    text: 'Spend ceilings in USD, per agent or shared, with estimated and actual cost tracked on every run.',
    title: 'Budgets that bind',
  },
  {
    icon: GitBranchIcon,
    id: 'subagents',
    text: 'A sub-agent is just another agent bound as a tool; its delegated run returns a full trace inline.',
    title: 'Sub-agents, traced',
  },
  {
    icon: MoonIcon,
    id: 'dreaming',
    text: 'Dedicated dreaming passes review recent logs and improve long-running memory between work runs.',
    title: 'Memory that compounds',
  },
]

export function LandingProductionIntro({
  shouldReduceMotion,
}: {
  shouldReduceMotion: boolean
}) {
  return (
    <section
      className="px-4 pt-20 pb-4 sm:px-6 md:px-10 md:pt-28 lg:px-12"
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
              <h2 className="mt-4 text-balance font-semibold text-3xl leading-tight tracking-tight md:text-4xl">
                Everything an autonomous agent needs to be trusted.
              </h2>
            </div>
            <p className="max-w-2xl text-muted-foreground leading-relaxed">
              Letting software act on its own is only safe when you can see what
              it does, cap what it spends, and step in when it matters. That
              governance is built in, then proven live below.
            </p>
          </motion.div>

          <motion.ul
            className="mt-10 grid gap-px border border-border bg-border sm:grid-cols-2 lg:grid-cols-3"
            variants={revealVariants}
          >
            {readinessCards.map((card) => {
              const Icon = card.icon
              return (
                <li
                  className="flex min-h-52 flex-col bg-background p-6"
                  key={card.id}
                >
                  <div className="flex items-center gap-3">
                    <span className="grid size-9 place-items-center border border-border bg-background text-foreground">
                      <Icon className="size-4" />
                    </span>
                    <h3 className="font-semibold text-base tracking-tight">
                      {card.title}
                    </h3>
                  </div>
                  <p className="mt-4 text-muted-foreground text-sm leading-relaxed">
                    {card.text}
                  </p>
                </li>
              )
            })}
          </motion.ul>
        </motion.div>
      </LazyMotion>
    </section>
  )
}
