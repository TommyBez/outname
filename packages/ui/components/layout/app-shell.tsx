import {
  AppSidebar,
  AppSidebarFallback,
} from '@outname/ui/components/layout/app-sidebar'
import { CommandPaletteTrigger } from '@outname/ui/components/layout/command-palette'
import { TimezoneBootstrapLoader } from '@outname/ui/components/layout/timezone-bootstrap-loader'
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@outname/ui/components/ui/sidebar'
import { cn } from '@outname/ui/lib/utils'
import Link from 'next/link'
import { Suspense } from 'react'

interface AppShellProps {
  children: React.ReactNode
  mainClassName?: string
  sidebarExtras?: React.ReactNode
}

const DEFAULT_MAIN_CLASS =
  'mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-10 md:px-8 md:py-12 lg:px-12 lg:py-20'

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
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:border focus:border-border focus:bg-accent focus:px-4 focus:py-3 focus:font-bold focus:text-foreground focus:text-xs focus:uppercase focus:tracking-[0.18em]"
        href="#main-content"
      >
        Skip to content
      </a>
      <Suspense fallback={<AppSidebarFallback />}>
        <AppSidebar sidebarExtras={sidebarExtras} />
      </Suspense>
      <Suspense fallback={null}>
        <TimezoneBootstrapLoader />
      </Suspense>
      <SidebarInset className="swiss-grid-pattern min-w-0 bg-background">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-border border-b bg-background px-3 lg:h-12 lg:px-4">
          <SidebarTrigger className="-ml-1 size-10 border-border lg:size-9" />
          <Link
            className="inline-flex min-h-11 items-center gap-2 font-bold text-sm uppercase tracking-[0.2em] transition-colors hover:text-brand lg:hidden"
            href="/dashboard"
          >
            <span aria-hidden className="inline-block size-3 bg-brand" />
            <span>outna.me</span>
          </Link>
          <CommandPaletteTrigger />
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
