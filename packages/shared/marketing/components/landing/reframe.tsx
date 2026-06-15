'use client'

import {
  Reveal,
  RevealGroup,
  RevealItem,
  SwissLabel,
} from '@outname/shared/marketing/components/landing/section-kit'

const PROMPT_LINES = [
  'Answers once',
  'Waits for you',
  'Forgets by the next tab',
]
const AGENT_LINES = [
  'Runs on a schedule',
  'Pushes the work itself',
  'Remembers in readable files',
]

export function Reframe() {
  return (
    <section className="relative bg-secondary px-4 py-20 sm:px-6 md:px-10 md:py-28 lg:px-12">
      <div className="mx-auto w-full max-w-7xl border-foreground border-t-4 pt-6">
        <Reveal>
          <SwissLabel className="text-accent">Why agents</SwissLabel>
          <h2 className="mt-6 max-w-4xl text-balance font-black text-4xl uppercase leading-[0.92] tracking-tight sm:text-5xl md:text-6xl">
            You don&apos;t need a better chat. You need work that keeps moving.
          </h2>
          <p className="mt-6 max-w-2xl text-muted-foreground leading-relaxed md:text-lg">
            A prompt answers once, then waits for you. An agent keeps a role,
            remembers in files, runs on a schedule, and comes back to the work —
            even when you don&apos;t.
          </p>
        </Reveal>

        <RevealGroup className="mt-12 grid gap-4 md:grid-cols-2">
          <RevealItem className="border-2 border-foreground bg-background p-6">
            <SwissLabel className="text-muted-foreground">A prompt</SwissLabel>
            <ul className="mt-5 flex flex-col gap-3">
              {PROMPT_LINES.map((line) => (
                <li
                  className="flex items-center gap-3 text-muted-foreground"
                  key={line}
                >
                  <span
                    aria-hidden
                    className="size-2 shrink-0 bg-muted-foreground"
                  />
                  {line}
                </li>
              ))}
            </ul>
          </RevealItem>
          <RevealItem className="border-2 border-foreground bg-foreground p-6 text-background">
            <SwissLabel className="text-accent">An agent</SwissLabel>
            <ul className="mt-5 flex flex-col gap-3">
              {AGENT_LINES.map((line) => (
                <li className="flex items-center gap-3" key={line}>
                  <span aria-hidden className="size-2 shrink-0 bg-accent" />
                  {line}
                </li>
              ))}
            </ul>
          </RevealItem>
        </RevealGroup>
      </div>
    </section>
  )
}
