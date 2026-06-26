'use client'

import { getAppLoginUrl } from '@outname/shared/app-url'
import { AgentFileTree } from '@outname/shared/marketing/components/landing/agent-anatomy/agent-file-tree'
import { PrimaryLink } from '@outname/shared/marketing/components/landing/primary-link'
import { SecondaryLink } from '@outname/shared/marketing/components/landing/secondary-link'
import { TextLoop } from '@outname/shared/marketing/components/motion-primitives/text-loop'

const loopWords = [
  'agents',
  'tools',
  'sub-agents',
  'channels',
  'memory',
] as const

export function LandingHeroDemo({
  shouldReduceMotion,
}: {
  shouldReduceMotion: boolean
}) {
  return (
    <section className="relative px-4 pt-20 pb-20 sm:px-6 sm:pt-24 md:px-10 md:pb-28 lg:px-12 lg:pt-28">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-12 border-border border-t pt-8">
        <p className="swiss-label text-muted-foreground">
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

        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)] lg:items-center">
          <div className="min-w-0">
            <h1 className="home-display text-balance font-semibold text-5xl leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
              Agents that keep working.
            </h1>
          </div>
          <div className="hidden lg:block">
            <AgentFileTree />
            <p className="mt-3 font-mono text-[10px] text-muted-foreground tracking-normal">
              one agent · one folder you can read
            </p>
          </div>
        </div>

        <div className="grid gap-8 border-border border-t pt-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <p className="max-w-2xl text-base leading-relaxed md:text-lg">
            They remember. They learn. They call other agents. Every run
            sharpens the next.
          </p>
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row md:justify-end">
            <PrimaryLink href={getAppLoginUrl('/agents/new')}>
              Start building
            </PrimaryLink>
            <SecondaryLink href={getAppLoginUrl('/dashboard')}>
              Login
            </SecondaryLink>
          </div>
        </div>
      </div>
    </section>
  )
}
