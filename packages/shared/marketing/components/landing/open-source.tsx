'use client'

import { SiGithub } from '@icons-pack/react-simple-icons'
import {
  Reveal,
  SwissLabel,
} from '@outname/shared/marketing/components/landing/section-kit'
import { githubRepositoryUrl } from '@outname/shared/marketing/data/social-links'
import Link from 'next/link'

export function OpenSource() {
  return (
    <section
      className="relative scroll-mt-28 bg-foreground px-4 py-20 text-background sm:px-6 md:px-10 md:py-28 lg:px-12"
      id="open-source"
    >
      <div className="mx-auto w-full max-w-7xl">
        <Reveal>
          <div className="grid gap-8 md:grid-cols-[10rem_minmax(0,1fr)] md:gap-10">
            <div className="flex items-baseline gap-3 md:flex-col md:gap-3">
              <span className="font-mono text-accent text-sm tabular-nums">
                07
              </span>
              <SwissLabel className="text-background/60">
                Open source
              </SwissLabel>
            </div>
            <div className="min-w-0 max-w-4xl">
              <h2 className="text-balance font-black text-4xl uppercase leading-[0.92] tracking-tight sm:text-5xl md:text-6xl">
                Hosted by default. <span className="text-accent">Open</span> at
                the capability layer.
              </h2>
              <p className="mt-6 max-w-2xl text-background/70 leading-relaxed md:text-lg">
                The codebase is MIT-licensed. Inspect the stack, fork it, or
                contribute the tools you need — no black box. Open source is the
                trust and contribution layer, not a self-hosting requirement.
              </p>
              <Link
                className="ease mt-8 inline-flex min-h-14 items-center gap-3 border-2 border-background bg-background px-6 font-bold text-foreground text-xs uppercase tracking-[0.12em] transition-colors duration-150 hover:border-accent hover:bg-accent hover:text-foreground"
                href={githubRepositoryUrl}
                rel="noopener noreferrer"
                target="_blank"
              >
                <SiGithub aria-hidden size={18} title="" />
                Read the source on GitHub
              </Link>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
