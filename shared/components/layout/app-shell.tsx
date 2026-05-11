import Link from 'next/link'
import { Suspense } from 'react'
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { cn } from '@/lib/utils'
import {
  AppSidebar,
  AppSidebarFallback,
} from '@/shared/components/layout/app-sidebar'

interface AppShellProps {
  children: React.ReactNode
  mainClassName?: string
  sidebarExtras?: React.ReactNode
}

const DEFAULT_MAIN_CLASS =
  'mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6 sm:py-12 md:px-10 md:py-16 lg:px-12 lg:py-20'

export function AppShell({
  children,
  sidebarExtras,
  mainClassName,
}: AppShellProps) {
  // Keep the shell static so page-level Suspense can prerender cleanly.
  // SidebarProvider restores client state from its cookie after hydration,
  // so the server render still defaults to open on a hard reload.
  return (
    <SidebarProvider defaultOpen>
      <a
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:border-2 focus:border-foreground focus:bg-accent focus:px-4 focus:py-3 focus:font-bold focus:text-foreground focus:text-xs focus:uppercase focus:tracking-[0.18em]"
        href="#main-content"
      >
        Skip to content
      </a>
      <Suspense fallback={<AppSidebarFallback />}>
        <AppSidebar sidebarExtras={sidebarExtras} />
      </Suspense>
      <SidebarInset className="swiss-grid-pattern min-w-0 bg-background">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-foreground border-b-2 bg-background px-3 md:h-12 md:px-4">
          <SidebarTrigger className="-ml-1 size-10 border-foreground md:size-9" />
          <Link
            className="inline-flex min-h-11 items-center gap-2 font-bold text-sm uppercase tracking-[0.2em] transition-colors hover:text-accent md:hidden"
            href="/dashboard"
          >
            <span aria-hidden className="inline-block size-3 bg-accent" />
            <span>agents</span>
          </Link>
        </header>
        <main
          className={cn(mainClassName ?? DEFAULT_MAIN_CLASS)}
          id="main-content"
        >
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
