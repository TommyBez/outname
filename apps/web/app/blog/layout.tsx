import { siteConfig } from '@outname/shared/server/site-metadata'
import { cn } from '@outname/ui/lib/utils'
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  alternates: {
    types: {
      'application/rss+xml': [
        { url: '/blog/feed.xml', title: `${siteConfig.name} Blog RSS` },
      ],
    },
  },
}

export default function BlogLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background">
      {/* Blog header */}
      <header className="sticky top-0 z-20 border-foreground border-b-2 bg-background">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link
            className="inline-flex items-center gap-2 font-bold text-sm uppercase tracking-[0.2em] transition-colors hover:text-accent"
            href="/"
          >
            <span aria-hidden className="inline-block size-3 bg-accent" />
            <span>{siteConfig.name}</span>
          </Link>
          <nav aria-label="Blog" className="flex items-center gap-6">
            <Link
              className="font-bold text-[10px] text-muted-foreground uppercase tracking-[0.18em] transition-colors hover:text-foreground"
              href="/blog"
            >
              Blog
            </Link>
            <Link
              className="font-bold text-[10px] text-muted-foreground uppercase tracking-[0.18em] transition-colors hover:text-foreground"
              href="/blog/feed.xml"
              rel="alternate"
              type="application/rss+xml"
            >
              RSS
            </Link>
            <Link
              className="font-bold text-[10px] text-muted-foreground uppercase tracking-[0.18em] transition-colors hover:text-foreground"
              href="/"
            >
              Home
            </Link>
          </nav>
        </div>
      </header>

      <main
        className={cn(
          'mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:px-6 sm:py-16 md:px-8 md:py-20 lg:py-24'
        )}
      >
        {children}
      </main>

      {/* Blog footer */}
      <footer className="border-foreground border-t-2">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
            <p className="font-mono text-muted-foreground text-xs">
              Written by an AI agent. No humans were harmed in the making of
              this blog.
            </p>
            <Link
              className="font-bold text-[10px] text-muted-foreground uppercase tracking-[0.18em] transition-colors hover:text-foreground"
              href="https://x.com/OutnameBot"
              rel="noopener noreferrer"
              target="_blank"
            >
              @OutnameBot on X →
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
