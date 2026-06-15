'use client'

import {
  revealVariants,
  staggerVariants,
} from '@outname/shared/marketing/components/landing/landing-motion'
import { cn } from '@outname/ui/lib/utils'
import { motion, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'

/**
 * Shared building blocks for the landing page.
 *
 * Design language: Swiss International "datasheet". Massive black uppercase
 * display type against tiny monospace labels, hard 2px/4px rules, zero radius,
 * and Swiss red (--accent) used only as a signal. Every section is framed like
 * a numbered entry in a technical spec sheet for an agent.
 */

const VIEWPORT = { once: true, margin: '-80px' } as const

/** Single scroll-triggered reveal. Falls back to static when motion is reduced. */
export function Reveal({
  children,
  className,
  as = 'div',
}: {
  children: ReactNode
  className?: string
  as?: 'div' | 'li'
}) {
  const reduceMotion = useReducedMotion()
  const Tag = as === 'li' ? motion.li : motion.div

  if (reduceMotion) {
    const Static = as === 'li' ? 'li' : 'div'
    return <Static className={className}>{children}</Static>
  }

  return (
    <Tag
      className={className}
      initial="hidden"
      variants={revealVariants}
      viewport={VIEWPORT}
      whileInView="visible"
    >
      {children}
    </Tag>
  )
}

/** Stagger container — its direct {@link RevealItem} children animate in sequence. */
export function RevealGroup({
  children,
  className,
  as = 'div',
}: {
  children: ReactNode
  className?: string
  as?: 'div' | 'ul'
}) {
  const reduceMotion = useReducedMotion()
  const Tag = as === 'ul' ? motion.ul : motion.div

  if (reduceMotion) {
    const Static = as === 'ul' ? 'ul' : 'div'
    return <Static className={className}>{children}</Static>
  }

  return (
    <Tag
      className={className}
      initial="hidden"
      variants={staggerVariants}
      viewport={VIEWPORT}
      whileInView="visible"
    >
      {children}
    </Tag>
  )
}

/** Item inside a {@link RevealGroup}. Inherits timing from the parent stagger. */
export function RevealItem({
  children,
  className,
  as = 'div',
}: {
  children: ReactNode
  className?: string
  as?: 'div' | 'li'
}) {
  const reduceMotion = useReducedMotion()
  const Tag = as === 'li' ? motion.li : motion.div

  if (reduceMotion) {
    const Static = as === 'li' ? 'li' : 'div'
    return <Static className={className}>{children}</Static>
  }

  return (
    <Tag className={className} variants={revealVariants}>
      {children}
    </Tag>
  )
}

/** Tiny uppercase Swiss label. */
export function SwissLabel({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return <span className={cn('swiss-label', className)}>{children}</span>
}

/**
 * Standard section frame: a 4px top rule, a numbered left rail (index + label),
 * a massive headline, and an optional lead paragraph. Body content follows.
 */
export function SectionShell({
  id,
  index,
  label,
  title,
  lead,
  children,
  className,
  titleClassName,
  tone = 'default',
}: {
  id?: string
  index: string
  label: string
  title: ReactNode
  lead?: ReactNode
  children?: ReactNode
  className?: string
  titleClassName?: string
  tone?: 'default' | 'secondary'
}) {
  return (
    <section
      className={cn(
        'relative scroll-mt-28 px-4 py-20 sm:px-6 md:px-10 md:py-28 lg:px-12',
        tone === 'secondary' && 'bg-secondary',
        className
      )}
      id={id}
    >
      <div className="mx-auto w-full max-w-7xl border-foreground border-t-4 pt-6">
        <Reveal>
          <div className="grid gap-6 md:grid-cols-[10rem_minmax(0,1fr)] md:gap-10">
            <div className="flex items-baseline gap-3 md:flex-col md:gap-3">
              <span className="font-mono text-accent text-sm tabular-nums">
                {index}
              </span>
              <SwissLabel className="text-muted-foreground">{label}</SwissLabel>
            </div>
            <div className="min-w-0 max-w-4xl">
              <h2
                className={cn(
                  'text-balance font-black text-4xl uppercase leading-[0.9] tracking-tight sm:text-5xl md:text-6xl',
                  titleClassName
                )}
              >
                {title}
              </h2>
              {lead ? (
                <p className="mt-6 max-w-2xl text-base text-muted-foreground leading-relaxed md:text-lg">
                  {lead}
                </p>
              ) : null}
            </div>
          </div>
        </Reveal>
        {children ? <div className="mt-12 md:mt-16">{children}</div> : null}
      </div>
    </section>
  )
}
