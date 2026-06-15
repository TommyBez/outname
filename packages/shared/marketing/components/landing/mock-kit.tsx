'use client'

import {
  Reveal,
  SwissLabel,
} from '@outname/shared/marketing/components/landing/section-kit'
import { cn } from '@outname/ui/lib/utils'
import type { ReactNode } from 'react'

/**
 * Mock kit — Swiss-styled product-UI primitives used to *show* the product
 * (rosters, ledgers, config panels) instead of describing it in text grids.
 * Every mock is illustrative, not live telemetry.
 */

/** Bordered product panel with a black title bar and optional footer caption. */
export function Panel({
  title,
  status,
  children,
  footer,
  className,
}: {
  title: string
  status?: ReactNode
  children: ReactNode
  footer?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'w-full border-2 border-foreground bg-background',
        className
      )}
    >
      <div className="flex items-center justify-between gap-2 border-foreground border-b-2 bg-foreground px-4 py-2.5 text-background">
        <SwissLabel>{title}</SwissLabel>
        {status}
      </div>
      {children}
      {footer ? (
        <div className="border-foreground border-t-2 px-4 py-2 font-mono text-[0.625rem] text-muted-foreground uppercase tracking-[0.16em]">
          {footer}
        </div>
      ) : null}
    </div>
  )
}

const TAG_TONES = {
  accent: 'bg-accent text-background',
  solid: 'bg-foreground text-background',
  outline: 'border-2 border-foreground text-foreground',
  muted: 'bg-secondary text-muted-foreground',
} as const

/** Small monospace status tag. */
export function StatusTag({
  tone = 'muted',
  children,
  className,
}: {
  tone?: keyof typeof TAG_TONES
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 font-mono text-[0.625rem] uppercase leading-none tracking-[0.12em]',
        TAG_TONES[tone],
        className
      )}
    >
      {children}
    </span>
  )
}

/** Square status indicator. */
export function Dot({ className }: { className?: string }) {
  return <span aria-hidden className={cn('size-2 shrink-0', className)} />
}

/** Monospace pill, optionally "on" (filled). */
export function Chip({
  children,
  on = false,
  className,
}: {
  children: ReactNode
  on?: boolean
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 border-2 px-2.5 py-1 font-mono text-xs',
        on
          ? 'border-foreground bg-foreground text-background'
          : 'border-border bg-background text-foreground',
        className
      )}
    >
      {children}
    </span>
  )
}

/** Horizontal usage bar (value 0–100). */
export function MockBar({
  value,
  className,
}: {
  value: number
  className?: string
}) {
  return (
    <div className="h-2 w-full border-2 border-foreground bg-background">
      <div
        className={cn('h-full bg-accent', className)}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  )
}

/**
 * Alternating text/visual deep-dive row. Text on the left by default; pass
 * `reverse` to flip the visual to the left on large screens.
 */
export function FeatureRow({
  id,
  index,
  label,
  title,
  body,
  bullets,
  visual,
  reverse = false,
  tone = 'default',
}: {
  id?: string
  index: string
  label: string
  title: ReactNode
  body: ReactNode
  bullets?: { t: string; d: string }[]
  visual: ReactNode
  reverse?: boolean
  tone?: 'default' | 'secondary'
}) {
  return (
    <section
      className={cn(
        'relative scroll-mt-28 px-4 py-16 sm:px-6 md:px-10 md:py-24 lg:px-12',
        tone === 'secondary' && 'bg-secondary'
      )}
      id={id}
    >
      <div className="mx-auto w-full max-w-7xl border-foreground border-t-2 pt-10">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <Reveal className={cn('flex flex-col', reverse && 'lg:order-2')}>
            <div className="flex items-baseline gap-3">
              <span className="font-mono text-accent text-sm tabular-nums">
                {index}
              </span>
              <SwissLabel className="text-muted-foreground">{label}</SwissLabel>
            </div>
            <h2 className="mt-5 text-balance font-black text-4xl uppercase leading-[0.92] tracking-tight sm:text-5xl">
              {title}
            </h2>
            <p className="mt-5 max-w-xl text-muted-foreground leading-relaxed md:text-lg">
              {body}
            </p>
            {bullets ? (
              <ul className="mt-7 flex flex-col gap-3">
                {bullets.map((bullet) => (
                  <li className="flex gap-3" key={bullet.t}>
                    <span
                      aria-hidden
                      className="mt-1.5 size-2 shrink-0 bg-accent"
                    />
                    <span className="text-sm leading-relaxed">
                      <span className="font-bold">{bullet.t}.</span>{' '}
                      <span className="text-muted-foreground">{bullet.d}</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </Reveal>
          <Reveal className={cn(reverse && 'lg:order-1')}>{visual}</Reveal>
        </div>
      </div>
    </section>
  )
}
