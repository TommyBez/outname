'use client'

import { ChatShowcasePanel } from '@outname/shared/marketing/components/landing/landing-chat-showcase'
import { HeartbeatPanel } from '@outname/shared/marketing/components/landing/landing-heartbeat-closer'
import {
  revealVariants,
  staggerVariants,
} from '@outname/shared/marketing/components/landing/landing-motion'
import { ProductionCard } from '@outname/shared/marketing/components/landing/production-card'
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
              <h2 className="mt-4 text-balance font-semibold text-3xl leading-tight tracking-tight md:text-4xl">
                Everything an autonomous agent needs to be trusted.
              </h2>
            </div>
            <p className="max-w-2xl text-muted-foreground leading-relaxed">
              Letting software act on its own is only safe when you can see what
              it does, cap what it spends, and step in when it matters. Here it
              is, proven live.
            </p>
          </motion.div>

          <div className="mt-10 grid gap-5">
            <ProductionCard
              index="01"
              text="The same memory, tools, and sub-agents answer in-app and in Slack. Pick a scenario and watch a run stream."
              title="One agent, every surface"
            >
              <ChatShowcasePanel shouldReduceMotion={shouldReduceMotion} />
            </ProductionCard>

            <ProductionCard
              index="02"
              text="Schedules fire, channels light up, sub-agents return, the memory grows. You read the log in the morning."
              title="It runs while you sleep"
            >
              <HeartbeatPanel shouldReduceMotion={shouldReduceMotion} />
            </ProductionCard>

            <ProductionCard
              index="03"
              text="Observability, durable execution, step limits, and budgets are built in — not bolted on after the fact."
              title="Guardrails that bind"
            >
              <ul className="grid gap-px border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
                {readinessCards.map((card) => {
                  const Icon = card.icon
                  return (
                    <li
                      className="flex min-h-44 flex-col bg-background p-5"
                      key={card.id}
                    >
                      <div className="flex items-center gap-3">
                        <span className="grid size-9 place-items-center border border-border bg-background text-foreground">
                          <Icon className="size-4" />
                        </span>
                        <h4 className="font-semibold text-sm tracking-tight">
                          {card.title}
                        </h4>
                      </div>
                      <p className="mt-3 text-muted-foreground text-sm leading-relaxed">
                        {card.text}
                      </p>
                    </li>
                  )
                })}
              </ul>
            </ProductionCard>
          </div>
        </motion.div>
      </LazyMotion>
    </section>
  )
}
