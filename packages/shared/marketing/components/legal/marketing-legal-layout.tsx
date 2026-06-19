import { siteConfig } from '@outname/shared/server/site-metadata'
import Link from 'next/link'
import type { ReactNode } from 'react'

export function MarketingLegalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-border border-b bg-background">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link
            className="inline-flex items-center gap-2 font-bold text-sm uppercase tracking-[0.2em] transition-colors hover:text-brand"
            href="/"
          >
            <span aria-hidden className="inline-block size-3 bg-brand" />
            <span>{siteConfig.name}</span>
          </Link>
          <nav
            aria-label="Legal"
            className="flex flex-wrap items-center justify-end gap-x-6 gap-y-2"
          >
            <Link
              className="font-bold text-[10px] text-muted-foreground uppercase tracking-[0.18em] transition-colors hover:text-foreground"
              href="/terms"
            >
              Terms
            </Link>
            <Link
              className="font-bold text-[10px] text-muted-foreground uppercase tracking-[0.18em] transition-colors hover:text-foreground"
              href="/privacy"
            >
              Privacy
            </Link>
            <Link
              className="font-bold text-[10px] text-muted-foreground uppercase tracking-[0.18em] transition-colors hover:text-foreground"
              href="/support"
            >
              Support
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:px-6 sm:py-16 md:px-8 md:py-20 lg:py-24">
        {children}
      </main>
    </div>
  )
}
