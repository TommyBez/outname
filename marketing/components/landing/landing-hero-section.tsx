'use client'

import { loopWords } from '@/marketing/components/landing/landing-data'
import {
  PrimaryLink,
  SecondaryLink,
} from '@/marketing/components/landing/landing-links'
import { TextLoop } from '@/marketing/components/motion-primitives/text-loop'

export function LandingHeroSection({
  shouldReduceMotion,
}: {
  shouldReduceMotion: boolean | null
}) {
  return (
    <div className="grid min-w-0 gap-6 border-foreground border-t-4 pt-5 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,0.38fr)] lg:items-end">
      <div className="min-w-0">
        <p className="swiss-label mb-5 text-accent">
          OUTNA.ME /
          <TextLoop
            className="ml-2 inline-flex"
            interval={1.7}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            trigger={!shouldReduceMotion}
          >
            {loopWords.map((word) => (
              <span key={word}>{word}</span>
            ))}
          </TextLoop>
        </p>
        <h1 className="home-display max-w-[11ch] text-wrap font-black text-6xl uppercase leading-[0.84] tracking-normal sm:text-7xl md:text-8xl xl:text-9xl">
          Agents with a workbench.
        </h1>
      </div>
      <div className="grid gap-5 lg:border-foreground lg:border-l-2 lg:pl-6">
        <p className="max-w-md text-base leading-relaxed md:text-lg">
          Create private AI agents with memory, schedules, and tools. They can
          chat, wake on a cadence, update markdown files, and leave a trace you
          can inspect.
        </p>
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row lg:flex-col xl:flex-row">
          <PrimaryLink href="/login?from=/agents/new">Create agent</PrimaryLink>
          <SecondaryLink href="#showcase">See capabilities</SecondaryLink>
        </div>
      </div>
    </div>
  )
}
