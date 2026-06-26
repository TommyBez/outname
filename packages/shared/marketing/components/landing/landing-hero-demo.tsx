'use client'

import { getAppLoginUrl } from '@outname/shared/app-url'
import { HeroArtifact } from '@outname/shared/marketing/components/landing/hero-artifact'
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

const terminalLines = [
  '$ git clone github.com/TommyBez/outname',
  '$ pnpm install',
  '$ pnpm dev:app',
] as const

export function LandingHeroDemo({
  shouldReduceMotion,
}: {
  shouldReduceMotion: boolean
}) {
  return (
    <section className="relative px-4 pt-20 pb-20 sm:px-6 sm:pt-24 md:px-10 md:pb-28 lg:px-12 lg:pt-28">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 border-border border-t pt-8">
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

        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:items-center lg:gap-16">
          <div className="min-w-0">
            <h1 className="home-display text-balance font-semibold text-5xl leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
              Agents that keep working.
            </h1>
            <p className="mt-7 max-w-xl text-base text-muted-foreground leading-relaxed md:text-lg">
              Open-source personal agents. Markdown they read, real tools you
              bind, and a heartbeat that keeps working while you sleep.
            </p>

            <div className="mt-8 border border-border bg-foreground p-4 font-mono text-background text-xs leading-relaxed">
              {terminalLines.map((line) => (
                <p className="truncate" key={line}>
                  {line}
                </p>
              ))}
            </div>

            <div className="mt-8 flex min-w-0 flex-col gap-3 sm:flex-row">
              <PrimaryLink href={getAppLoginUrl('/agents/new')}>
                Start building
              </PrimaryLink>
              <SecondaryLink href={getAppLoginUrl('/dashboard')}>
                Login
              </SecondaryLink>
            </div>
          </div>

          <div className="min-w-0">
            <HeroArtifact />
          </div>
        </div>
      </div>
    </section>
  )
}
