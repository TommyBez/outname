'use client'

import {
  revealVariants,
  staggerVariants,
} from '@outname/shared/marketing/components/landing/landing-motion'
import { platformPrimitives } from '@outname/shared/marketing/data/primitives'
import { cn } from '@outname/ui/lib/utils'
import {
  BoxIcon,
  CpuIcon,
  DatabaseIcon,
  KeyRoundIcon,
  LayersIcon,
  type LucideIcon,
  MessagesSquareIcon,
  WorkflowIcon,
  ZapIcon,
} from 'lucide-react'
import { domAnimation, LazyMotion, m as motion } from 'motion/react'

const primitiveIcons: Record<string, LucideIcon> = {
  auth: KeyRoundIcon,
  'chat-sdk': MessagesSquareIcon,
  inference: CpuIcon,
  neon: DatabaseIcon,
  next: LayersIcon,
  sandbox: BoxIcon,
  upstash: ZapIcon,
  workflow: WorkflowIcon,
}

// Real channels and connectors an agent can be wired to (see the channel types
// and the connection registry).
const integrations = [
  'in-app chat',
  'Slack',
  'GitHub',
  'Cal.com',
  'Resend',
  'Firecrawl',
  'PostHog',
  'Parallel',
  'Typefully',
  'X',
  'Supabase',
  'v0',
  'Vercel',
  'Context7',
] as const

export function LandingPrimitives({
  shouldReduceMotion,
}: {
  shouldReduceMotion: boolean
}) {
  return (
    <section
      className="px-4 py-20 sm:px-6 md:px-10 md:py-28 lg:px-12"
      id="primitives"
    >
      <LazyMotion features={domAnimation}>
        <motion.div
          className="mx-auto max-w-7xl"
          initial={shouldReduceMotion ? false : 'hidden'}
          variants={staggerVariants}
          viewport={{ margin: '-80px', once: true }}
          whileInView="visible"
        >
          <motion.div
            className="grid gap-5 border-border border-t pt-5 md:grid-cols-[minmax(0,0.82fr)_minmax(0,1fr)] md:items-end"
            variants={revealVariants}
          >
            <div>
              <p className="swiss-label text-muted-foreground">
                Built on primitives
              </p>
              <h2 className="mt-4 text-balance font-semibold text-3xl leading-tight tracking-tight md:text-4xl">
                Nothing you can't host yourself.
              </h2>
            </div>
            <p className="max-w-2xl text-muted-foreground leading-relaxed">
              outname is open source and sits on building blocks you already
              trust. Bring your own keys, swap the providers, run the whole
              thing on your own infrastructure.
            </p>
          </motion.div>

          <motion.ul
            className="mt-10 border-border border-t"
            variants={revealVariants}
          >
            {platformPrimitives.map((primitive, index) => {
              const Icon = primitiveIcons[primitive.id] ?? LayersIcon
              return (
                <li
                  className="grid gap-3 border-border border-b py-6 md:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] md:items-baseline md:gap-10"
                  key={primitive.id}
                >
                  <div className="flex items-center gap-4">
                    <span className="font-mono text-muted-foreground text-xs tabular-nums">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <span className="grid size-9 place-items-center border border-border bg-background text-foreground">
                      <Icon className="size-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="font-semibold text-base tracking-tight">
                        {primitive.name}
                      </p>
                      {primitive.meta ? (
                        <p className="font-mono text-[10px] text-muted-foreground tracking-normal">
                          {primitive.meta}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <p className="text-muted-foreground leading-relaxed">
                    {primitive.role}
                  </p>
                </li>
              )
            })}
          </motion.ul>

          <motion.div
            className="mt-10 flex flex-col gap-4 border border-border bg-muted p-6 md:flex-row md:items-center md:gap-8"
            variants={revealVariants}
          >
            <p className="swiss-label shrink-0 text-muted-foreground">
              Channels &amp; connectors
            </p>
            <ul className="flex flex-wrap gap-2">
              {integrations.map((integration, index) => (
                <li key={integration}>
                  <span
                    className={cn(
                      'border border-border px-2.5 py-1 font-mono text-[11px] tracking-normal',
                      index < 2
                        ? 'bg-foreground text-background'
                        : 'bg-background text-muted-foreground'
                    )}
                  >
                    {integration}
                  </span>
                </li>
              ))}
            </ul>
          </motion.div>
        </motion.div>
      </LazyMotion>
    </section>
  )
}
