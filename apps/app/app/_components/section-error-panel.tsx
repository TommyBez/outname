'use client'

import { Button } from '@outname/ui/components/ui/button'
import Link from 'next/link'

interface SectionErrorPanelProps {
  description: string
  digest?: string
  homeHref?: string
  homeLabel?: string
  onReset?: () => void
  title: string
}

/**
 * Inline error panel for segment-level error boundaries. Unlike
 * AppErrorScreen it renders inside the app shell, so the sidebar and header
 * stay usable while the failed section offers recovery.
 */
export function SectionErrorPanel({
  description,
  digest,
  homeHref = '/dashboard',
  homeLabel = 'Back to dashboard',
  onReset,
  title,
}: SectionErrorPanelProps) {
  return (
    <div className="border border-border bg-background p-8" role="alert">
      <p className="swiss-label text-muted-foreground">Error</p>
      <h1 className="mt-4 text-balance font-semibold text-4xl tracking-tight">
        {title}
      </h1>
      <p className="mt-4 max-w-md text-pretty text-muted-foreground text-sm">
        {description}
      </p>
      {digest ? (
        <p className="mt-3 font-mono text-muted-foreground text-xs">
          Reference: {digest}
        </p>
      ) : null}
      <div className="mt-8 flex flex-wrap gap-3">
        {onReset ? (
          <Button onClick={onReset} type="button">
            Try again
          </Button>
        ) : null}
        <Button asChild variant="outline">
          <Link href={homeHref}>{homeLabel}</Link>
        </Button>
      </div>
    </div>
  )
}
