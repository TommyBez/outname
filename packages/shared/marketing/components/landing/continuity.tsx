'use client'

import { MockLedger } from '@outname/shared/marketing/components/landing/mock-ledger'
import {
  Reveal,
  RevealGroup,
  RevealItem,
  SectionShell,
  SwissLabel,
} from '@outname/shared/marketing/components/landing/section-kit'

const POINTS = [
  {
    title: 'Heartbeat & dreaming',
    body: 'Recurring runs, from every 5 minutes to once a day.',
  },
  {
    title: 'Durable',
    body: 'Cron plus a Redis lock; stale runs get recovered.',
  },
  {
    title: 'Visible',
    body: 'Queued, running, completed, failed — the whole ledger.',
  },
] as const

export function Continuity() {
  return (
    <SectionShell
      id="continuity"
      index="03"
      label="Continuity"
      lead="Scheduled heartbeats continue the work without a live prompt. Every run is a durable event with a status you can actually see."
      title="It runs while you sleep."
    >
      <Reveal>
        <MockLedger />
      </Reveal>
      <RevealGroup className="mt-4 grid gap-4 sm:grid-cols-3">
        {POINTS.map((point) => (
          <RevealItem
            className="flex flex-col gap-2 border-2 border-foreground bg-background p-6"
            key={point.title}
          >
            <SwissLabel className="text-accent">{point.title}</SwissLabel>
            <p className="text-muted-foreground text-sm leading-relaxed">
              {point.body}
            </p>
          </RevealItem>
        ))}
      </RevealGroup>
    </SectionShell>
  )
}
