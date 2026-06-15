'use client'

import { MockCompose } from '@outname/shared/marketing/components/landing/mock-compose'
import {
  Reveal,
  SectionShell,
  SwissLabel,
} from '@outname/shared/marketing/components/landing/section-kit'
import { githubRepositoryUrl } from '@outname/shared/marketing/data/social-links'
import { cn } from '@outname/ui/lib/utils'
import { ArrowUpRight } from 'lucide-react'
import Link from 'next/link'

const STEPS = [
  {
    n: '01',
    title: 'Implement it',
    body: 'Build the missing maintainer tool in the open-source repo.',
  },
  {
    n: '02',
    title: 'Open a PR',
    body: 'Guided by the repo’s maintainer-tool-implementation skill.',
  },
  {
    n: '03',
    title: 'It ships hosted',
    body: 'After review and merge, it joins the hosted catalog.',
  },
] as const

export function Compose() {
  return (
    <SectionShell
      id="compose"
      index="05"
      label="Compose"
      lead="Capabilities snap into named slots: attach maintainer tools, sub-agents, and skills. Miss one? The tool layer is open source — so you add it instead of waiting."
      title="An agent is what you attach — or what you build."
    >
      <div className="grid gap-10 lg:grid-cols-2 lg:gap-14">
        <Reveal className="flex flex-col gap-5">
          <SwissLabel className="text-muted-foreground">
            Attach what exists
          </SwissLabel>
          <MockCompose />
        </Reveal>

        <Reveal className="flex flex-col gap-5">
          <SwissLabel className="text-muted-foreground">
            Build what’s missing
          </SwissLabel>
          <ol className="flex flex-col">
            {STEPS.map((step, index) => (
              <li
                className={cn(
                  'flex gap-4 border-2 border-foreground bg-background p-5',
                  index > 0 && 'border-t-0'
                )}
                key={step.n}
              >
                <span className="font-mono text-accent text-sm tabular-nums">
                  {step.n}
                </span>
                <div>
                  <h3 className="font-bold text-base uppercase tracking-tight">
                    {step.title}
                  </h3>
                  <p className="mt-1 text-muted-foreground text-sm leading-relaxed">
                    {step.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
          <Link
            className="ease inline-flex items-center gap-2 font-bold text-sm uppercase tracking-[0.12em] underline-offset-4 transition-colors duration-150 hover:text-accent hover:underline"
            href={githubRepositoryUrl}
            rel="noopener noreferrer"
            target="_blank"
          >
            Read the source
            <ArrowUpRight aria-hidden className="size-4" />
          </Link>
        </Reveal>
      </div>
    </SectionShell>
  )
}
