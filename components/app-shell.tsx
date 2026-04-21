import { Suspense } from "react"
import Link from "next/link"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { AppSidebar, AppSidebarFallback } from "@/components/app-sidebar"

export function AppShell({ children }: { children: React.ReactNode }) {
  // Keep the shell fully static so it prerenders cleanly alongside the
  // page-level <Suspense> boundaries. The sidebar's toggle state lives on
  // the client and is persisted via a cookie written by SidebarProvider —
  // for a hard reload we default to open, which is the right call for this
  // app's 4-item nav.
  return (
    <SidebarProvider defaultOpen>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-foreground focus:px-3 focus:py-2 focus:text-sm focus:text-background focus:shadow-md"
      >
        Skip to content
      </a>
      <Suspense fallback={<AppSidebarFallback />}>
        <AppSidebar />
      </Suspense>
      <SidebarInset className="min-w-0">
        {/* Compact top bar: visible on all breakpoints for sidebar toggle,
            but the brand mark only shows on mobile where the sidebar is a
            drawer and the user needs a visible anchor. */}
        <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-border bg-background/80 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:h-12 md:px-4">
          <SidebarTrigger className="-ml-1 size-9 md:size-8" />
          <Link
            href="/"
            className="inline-flex items-center gap-2 font-mono text-sm font-medium uppercase tracking-[0.18em] transition-colors hover:text-foreground/80 md:hidden"
          >
            <span aria-hidden className="inline-block size-2 bg-accent" />
            <span>agents</span>
          </Link>
        </header>
        <main
          id="main-content"
          className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6 sm:py-10 md:px-8 md:py-14 lg:py-16"
        >
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
