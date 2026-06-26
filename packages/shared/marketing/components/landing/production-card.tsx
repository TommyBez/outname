import { revealVariants } from '@outname/shared/marketing/components/landing/landing-motion'
import { m as motion } from 'motion/react'
import type { ReactNode } from 'react'

export function ProductionCard({
  index,
  title,
  text,
  children,
}: {
  index: string
  title: string
  text: string
  children: ReactNode
}) {
  return (
    <motion.div
      className="border border-border bg-background"
      variants={revealVariants}
    >
      <div className="grid gap-5 border-border border-b p-6 md:grid-cols-[minmax(0,0.75fr)_minmax(0,1fr)] md:items-end md:p-8">
        <div className="flex items-baseline gap-4">
          <span className="font-mono text-muted-foreground text-sm tabular-nums">
            {index}
          </span>
          <h3 className="text-balance font-semibold text-2xl leading-tight tracking-tight md:text-3xl">
            {title}
          </h3>
        </div>
        <p className="text-muted-foreground leading-relaxed">{text}</p>
      </div>
      <div className="p-4 sm:p-6 md:p-8">{children}</div>
    </motion.div>
  )
}
