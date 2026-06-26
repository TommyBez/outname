'use client'

import {
  revealVariants,
  staggerVariants,
} from '@outname/shared/marketing/components/landing/landing-motion'
import { cn } from '@outname/ui/lib/utils'
import {
  BrainIcon,
  ContactIcon,
  type LucideIcon,
  TargetIcon,
} from 'lucide-react'
import { domAnimation, LazyMotion, m as motion } from 'motion/react'

interface ConceptFacet {
  files: readonly string[]
  icon: LucideIcon
  id: string
  text: string
  title: string
}

const facets: readonly ConceptFacet[] = [
  {
    files: ['AGENTS.md', 'IDENTITY.md', 'SOUL.md'],
    icon: ContactIcon,
    id: 'authored',
    text: 'You write its instructions, identity card, and persona. They are injected into every prompt it runs.',
    title: 'You author who it is',
  },
  {
    files: ['MEMORY.md', 'TASKS.md', 'DREAMS.md'],
    icon: BrainIcon,
    id: 'memory',
    text: 'It keeps its own durable facts, open tasks, and reflection notes as markdown — append-only, with citations.',
    title: 'It writes what it learns',
  },
  {
    files: ['GOALS.md', 'CALENDAR.md', 'logs/'],
    icon: TargetIcon,
    id: 'horizon',
    text: 'Long-horizon goals, a dated calendar, and a per-day log bullet at the end of every run. All readable, all editable.',
    title: 'It tracks time and goals',
  },
]

export function LandingConcept({
  shouldReduceMotion,
}: {
  shouldReduceMotion: boolean
}) {
  return (
    <section
      className="px-4 py-20 sm:px-6 md:px-10 md:py-28 lg:px-12"
      id="concept"
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
                The mental model
              </p>
              <h2 className="mt-4 text-balance font-semibold text-3xl leading-tight tracking-tight md:text-4xl">
                An agent is a directory.
              </h2>
            </div>
            <p className="max-w-2xl text-muted-foreground leading-relaxed">
              Not a black box you prompt and hope. A folder of plain files you
              can open, edit, and trust: the memory it writes, the capabilities
              you bind, the schedule it runs on.
            </p>
          </motion.div>

          <motion.ul
            className="mt-10 grid gap-px border border-border bg-border md:grid-cols-3"
            variants={revealVariants}
          >
            {facets.map((facet) => {
              const Icon = facet.icon
              return (
                <li
                  className="flex min-h-64 flex-col bg-background p-6 lg:p-8"
                  key={facet.id}
                >
                  <span className="grid size-12 place-items-center border border-border bg-brand text-brand-foreground">
                    <Icon className="size-5" />
                  </span>
                  <h3 className="mt-6 font-semibold text-xl tracking-tight">
                    {facet.title}
                  </h3>
                  <p className="mt-3 text-muted-foreground text-sm leading-relaxed">
                    {facet.text}
                  </p>
                  <div className="mt-auto flex flex-wrap gap-1.5 pt-6">
                    {facet.files.map((file, fileIndex) => (
                      <span
                        className={cn(
                          'border border-border px-2 py-1 font-mono text-[10px] tracking-normal',
                          fileIndex === 0
                            ? 'bg-foreground text-background'
                            : 'bg-muted text-muted-foreground'
                        )}
                        key={file}
                      >
                        {file}
                      </span>
                    ))}
                  </div>
                </li>
              )
            })}
          </motion.ul>
        </motion.div>
      </LazyMotion>
    </section>
  )
}
