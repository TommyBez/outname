'use client'

import {
  RevealGroup,
  RevealItem,
  SectionShell,
} from '@outname/shared/marketing/components/landing/section-kit'

const STEPS = [
  {
    title: 'Configure',
    body: 'Pick a role, a model, a schedule, and the files it starts from. Guided by chat and reviewed before it saves.',
    detail: 'role · model · schedule',
  },
  {
    title: 'Attach',
    body: 'Give it tools, sub-agents, and skills. Set a budget. Connect your own inference provider key.',
    detail: 'tools · sub-agents · budget',
  },
  {
    title: 'Let it run',
    body: 'Heartbeats fire on schedule. The agent works, writes to readable memory, and logs every run.',
    detail: 'heartbeat · memory · ledger',
  },
] as const

export function HowItWorks() {
  return (
    <SectionShell
      id="how"
      index="01"
      label="How it works"
      lead="No stack to stand up. Three moves take you from an idea to an agent that keeps working."
      title="From idea to agent in three moves."
    >
      <RevealGroup className="grid gap-4 md:grid-cols-3">
        {STEPS.map((step, index) => (
          <RevealItem
            className="flex flex-col gap-4 border-2 border-foreground bg-background p-6"
            key={step.title}
          >
            <span className="font-black text-5xl text-secondary tabular-nums leading-none">
              {String(index + 1).padStart(2, '0')}
            </span>
            <h3 className="font-bold text-xl uppercase tracking-tight">
              {step.title}
            </h3>
            <p className="text-muted-foreground text-sm leading-relaxed">
              {step.body}
            </p>
            <p className="mt-auto border-foreground border-t-2 pt-3 font-mono text-[0.625rem] text-muted-foreground uppercase tracking-[0.14em]">
              {step.detail}
            </p>
          </RevealItem>
        ))}
      </RevealGroup>
    </SectionShell>
  )
}
