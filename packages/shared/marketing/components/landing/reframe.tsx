'use client'

import {
  Reveal,
  SwissLabel,
} from '@outname/shared/marketing/components/landing/section-kit'
import { Fragment } from 'react'

const ROWS = [
  { prompt: 'Answers once', agent: 'Runs on a schedule' },
  { prompt: 'Waits for you', agent: 'Pushes the work itself' },
  { prompt: 'Forgets by the next tab', agent: 'Remembers in readable files' },
] as const

export function Reframe() {
  return (
    <section className="relative bg-secondary px-4 py-20 sm:px-6 md:px-10 md:py-28 lg:px-12">
      <div className="mx-auto w-full max-w-7xl border-foreground border-t-4 pt-6">
        <Reveal>
          <div className="grid gap-6 md:grid-cols-[10rem_minmax(0,1fr)] md:gap-10">
            <SwissLabel className="text-accent">Why agents</SwissLabel>
            <div className="max-w-3xl">
              <h2 className="text-balance font-black text-4xl uppercase leading-[0.9] tracking-tight sm:text-5xl md:text-6xl">
                Stop prompting. Start operating.
              </h2>
              <p className="mt-5 max-w-xl text-muted-foreground leading-relaxed md:text-lg">
                A prompt answers once and waits for you. An agent keeps a role
                and comes back to the work on its own.
              </p>
            </div>
          </div>
        </Reveal>

        <Reveal>
          <div className="mt-12 grid grid-cols-2 gap-px border-2 border-foreground bg-foreground">
            <div className="bg-background px-5 py-3.5">
              <SwissLabel className="text-muted-foreground">
                A prompt
              </SwissLabel>
            </div>
            <div className="bg-foreground px-5 py-3.5">
              <SwissLabel className="text-accent">An agent</SwissLabel>
            </div>
            {ROWS.map((row) => (
              <Fragment key={row.prompt}>
                <div className="bg-background px-5 py-4 text-muted-foreground">
                  {row.prompt}
                </div>
                <div className="bg-background px-5 py-4 font-medium">
                  {row.agent}
                </div>
              </Fragment>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  )
}
