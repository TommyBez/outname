'use client'

import { composabilityStages } from '@outname/shared/marketing/data/composability-demo'
import { cornerLabels, stageIcons } from './constants'

export function ComposabilityStacked() {
  return (
    <div className="mx-auto mt-10 grid max-w-7xl gap-6 lg:grid-cols-2">
      {composabilityStages.map((stage) => {
        const Icon = stageIcons[stage.id]
        return (
          <article
            className="border border-border bg-background p-2"
            key={stage.id}
          >
            <div className="border border-border/15 bg-muted p-5">
              <div className="flex items-start justify-between gap-3 border-border border-b pb-4">
                <div>
                  <p className="swiss-label text-muted-foreground">
                    {stage.eyebrow}
                  </p>
                  <h3 className="mt-3 font-semibold text-2xl leading-tight tracking-tight md:text-3xl">
                    {stage.label}
                  </h3>
                </div>
                <span className="grid size-12 place-items-center border border-border bg-brand">
                  <Icon className="size-5" />
                </span>
              </div>

              <p className="mt-4 text-muted-foreground text-sm leading-relaxed">
                {stage.caption}
              </p>

              <div className="mt-5 grid gap-2">
                {stage.parts.map((part) => (
                  <span
                    className="border border-border bg-background px-3 py-2 font-mono text-[11px] tracking-normal"
                    key={part.id}
                  >
                    {part.label}
                  </span>
                ))}
              </div>

              <p className="mt-4 font-mono text-[10px] text-muted-foreground tracking-normal">
                Attaches to {cornerLabels[stage.corner]} slot of the agent
                shell.
              </p>
            </div>
          </article>
        )
      })}
    </div>
  )
}
