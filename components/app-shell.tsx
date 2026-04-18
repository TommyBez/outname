import Link from "next/link"
import { SignOutButton } from "./sign-out-button"
import { NavLink } from "./nav-link"

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-svh flex flex-col bg-background">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-foreground focus:px-3 focus:py-2 focus:text-sm focus:text-background focus:shadow-md"
      >
        Skip to content
      </a>
      <header className="border-b border-border">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-6 px-6 py-5 md:px-8">
          <Link
            href="/"
            className="font-serif text-lg font-medium tracking-tight transition-colors hover:text-foreground/80"
          >
            Inbox Assistant
          </Link>
          <nav className="flex items-center gap-6 text-sm" aria-label="Primary">
            <NavLink href="/">Today</NavLink>
            <NavLink href="/runs">History</NavLink>
            <NavLink href="/settings">Settings</NavLink>
            <SignOutButton />
          </nav>
        </div>
      </header>
      <main
        id="main-content"
        className="mx-auto w-full max-w-4xl flex-1 px-6 py-12 md:px-8 md:py-16"
      >
        {children}
      </main>
    </div>
  )
}
