'use client'

import {
  revealVariants,
  staggerVariants,
} from '@outname/shared/marketing/components/landing/landing-motion'
import {
  CpuIcon,
  GitBranchIcon,
  HammerIcon,
  HeartPulseIcon,
  type LucideIcon,
  MoonIcon,
  PuzzleIcon,
  RadioTowerIcon,
  WalletIcon,
} from 'lucide-react'
import { domAnimation, LazyMotion, m as motion } from 'motion/react'

interface Binding {
  chips: readonly string[]
  icon: LucideIcon
  id: string
  text: string
  title: string
}

// Every value below is real: providers and models from the inference layer,
// connectors from the connection registry, schedule modes from the agent form,
// budget periods from the budget schema.
const bindings: readonly Binding[] = [
  {
    chips: ['Vercel AI Gateway', 'LLM Gateway', 'OpenRouter'],
    icon: CpuIcon,
    id: 'model',
    text: 'Choose the inference provider and model per agent. Bring your own keys; the runtime stays model-agnostic.',
    title: 'Model',
  },
  {
    chips: ['every 30 min', 'or daily at set times'],
    icon: HeartPulseIcon,
    id: 'heartbeat',
    text: 'Wake it on an interval (5 min to daily) or at specific times. Each run does one small useful unit of work.',
    title: 'Heartbeat',
  },
  {
    chips: ['once per day'],
    icon: MoonIcon,
    id: 'dreaming',
    text: 'A separate reflection pass that reviews recent logs and sharpens long-running memory, even when heartbeat work is off.',
    title: 'Dreaming',
  },
  {
    chips: ['daily', 'weekly', 'monthly'],
    icon: WalletIcon,
    id: 'budget',
    text: 'Set a spend ceiling in USD per agent or across all of them, with estimated and actual cost tracked per run.',
    title: 'Budget',
  },
  {
    chips: ['in-app chat', 'Slack'],
    icon: RadioTowerIcon,
    id: 'channels',
    text: 'Bind the surfaces it listens and speaks on. The same agent answers in-app and in your Slack workspace.',
    title: 'Channels',
  },
  {
    chips: ['GitHub', 'Cal.com', 'Resend', 'Firecrawl', '+8'],
    icon: HammerIcon,
    id: 'tools',
    text: 'Attach maintainer tools backed by real connectors. The agent only ever calls what you bind to it.',
    title: 'Tools',
  },
  {
    chips: ['attach an agent as a tool'],
    icon: GitBranchIcon,
    id: 'subagents',
    text: 'Bind another agent as a callable tool. The parent delegates work and gets a traced run back inline.',
    title: 'Sub-agents',
  },
  {
    chips: ['from GitHub', 'or a SKILL.md'],
    icon: PuzzleIcon,
    id: 'skills',
    text: 'Install capability packages that run in a dedicated, persistent Skill Sandbox, isolated from the memory files.',
    title: 'Agent Skills',
  },
]

export function LandingBindings({
  shouldReduceMotion,
}: {
  shouldReduceMotion: boolean
}) {
  return (
    <section
      className="px-4 py-20 sm:px-6 md:px-10 md:py-28 lg:px-12"
      id="bindings"
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
                What you bind to it
              </p>
              <h2 className="mt-4 text-balance font-semibold text-3xl leading-tight tracking-tight md:text-4xl">
                The files are the agent. These are its powers.
              </h2>
            </div>
            <p className="max-w-2xl text-muted-foreground leading-relaxed">
              Around that folder you wire up the model it thinks with, when it
              wakes, what it can touch, and what it may spend. Every binding is
              a setting, not a guess.
            </p>
          </motion.div>

          <motion.ul
            className="mt-10 grid gap-px border border-border bg-border sm:grid-cols-2 lg:grid-cols-4"
            variants={revealVariants}
          >
            {bindings.map((binding) => {
              const Icon = binding.icon
              return (
                <li
                  className="flex min-h-56 flex-col bg-background p-6"
                  key={binding.id}
                >
                  <div className="flex items-center gap-3">
                    <span className="grid size-9 place-items-center border border-border bg-background text-foreground">
                      <Icon className="size-4" />
                    </span>
                    <h3 className="font-semibold text-base tracking-tight">
                      {binding.title}
                    </h3>
                  </div>
                  <p className="mt-4 text-muted-foreground text-sm leading-relaxed">
                    {binding.text}
                  </p>
                  <div className="mt-auto flex flex-wrap gap-1.5 pt-5">
                    {binding.chips.map((chip) => (
                      <span
                        className="border border-border bg-muted px-2 py-1 font-mono text-[10px] text-muted-foreground tracking-normal"
                        key={chip}
                      >
                        {chip}
                      </span>
                    ))}
                  </div>
                </li>
              )
            })}
          </motion.ul>
        </motion.div>
      </LazyMotion>
    </section>
  )
}
