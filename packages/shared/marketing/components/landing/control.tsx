'use client'

import { MockModelCatalog } from '@outname/shared/marketing/components/landing/mock-model-catalog'
import {
  Reveal,
  RevealGroup,
  RevealItem,
  SectionShell,
  SwissLabel,
} from '@outname/shared/marketing/components/landing/section-kit'

const CONTROLS = [
  {
    title: 'Budgets',
    body: 'Daily, weekly, or monthly USD rules that stop a run before it overspends.',
  },
  {
    title: 'Token usage',
    body: 'Usage and cost estimates, tracked and visible per agent.',
  },
  {
    title: 'Your key, your call',
    body: 'The provider key stays yours. OUTNA.ME runs the agents — it never resells tokens.',
  },
] as const

export function Control() {
  return (
    <SectionShell
      id="control"
      index="06"
      label="Models"
      lead="Set an API key for one or more gateways — Vercel AI Gateway, OpenRouter, or LLM Gateway — then pick from every model they serve, across providers. One key, the whole catalog."
      title="One key. Every model."
      tone="secondary"
    >
      <Reveal>
        <MockModelCatalog />
      </Reveal>

      <RevealGroup className="mt-4 grid gap-4 sm:grid-cols-3">
        {CONTROLS.map((control) => (
          <RevealItem
            className="flex flex-col gap-3 border-2 border-foreground bg-background p-6"
            key={control.title}
          >
            <SwissLabel className="text-accent">{control.title}</SwissLabel>
            <p className="text-muted-foreground text-sm leading-relaxed">
              {control.body}
            </p>
          </RevealItem>
        ))}
      </RevealGroup>
    </SectionShell>
  )
}
