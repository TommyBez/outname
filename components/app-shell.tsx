import Link from 'next/link'
import { Suspense } from 'react'
import { AppSidebar, AppSidebarFallback } from '@/components/app-sidebar'
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { cn } from '@/lib/utils'

interface AppShellProps {
  children: React.ReactNode
  /**
   * Replaces the default `<main>` classes. The default is a centred
   * reading column with generous vertical padding; chat surfaces opt
   * into a flush, full-height column so the composer can pin to the
   * viewport's bottom.
   */
  mainClassName?: string
  /**
   * Rendered inside the sidebar below the global nav group. Used to hang
   * contextual sections off the main sidebar (e.g. the agent workspace
   * section on `/agents/:id/*`) without introducing a second sidebar.
   * Pass an already-`Suspense`-wrapped server subtree to stream it in
   * alongside the page.
   */
  sidebarExtras?: React.ReactNode
}

const DEFAULT_MAIN_CLASS =
  'mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6 sm:py-12 md:px-10 md:py-16 lg:px-12 lg:py-20'

export function AppShell({
  children,
  sidebarExtras,
  mainClassName,
}: AppShellProps) {
  // Keep the shell fully static so it prerenders cleanly alongside the
  // page-level <Suspense> boundaries. The sidebar's toggle state lives on
  // the client and is persisted via a cookie written by SidebarProvider —
  // for a hard reload we default to open, which is the right call for this
  // app's 4-item nav.
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
        {/* Compact top bar: visible on all breakpoints for sidebar toggle,
            but the brand mark only shows on mobile where the sidebar is a
            drawer and the user needs a visible anchor. */}
        <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-foreground border-b-2 bg-background px-3 md:h-12 md:px-4">
          <SidebarTrigger className="-ml-1 size-10 border-foreground md:size-9" />
          <Link
            className="inline-flex min-h-11 items-center gap-2 font-bold text-sm uppercase tracking-[0.2em] transition-colors hover:text-accent md:hidden"
            href="/"
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
