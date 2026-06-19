'use client'

import { Button } from '@outname/ui/components/ui/button'
import Link from 'next/link'

interface AppErrorScreenProps {
  description: string
  digest?: string
  eyebrow: string
  onReset?: () => void
  title: string
}

export function AppErrorScreen({
  eyebrow,
  title,
  description,
  digest,
  onReset,
}: AppErrorScreenProps) {
  return (
    <main className="swiss-grid-pattern grid min-h-svh place-items-center bg-background px-6">
      <div className="max-w-md border border-border bg-background p-8">
        <p className="swiss-label text-brand">{eyebrow}</p>
        <h1 className="mt-4 text-balance font-black font-serif text-5xl uppercase leading-[0.9] tracking-tighter">
          {title}
        </h1>
        <p className="mt-4 text-pretty text-muted-foreground text-sm">
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
            <Link href="/">Back home</Link>
          </Button>
        </div>
      </div>
    </main>
  )
}
