import Link from "next/link"
import { SignOutButton } from "./sign-out-button"

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-svh flex flex-col bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-6 px-4 py-4 md:px-6">
          <Link href="/" className="flex items-center gap-2">
            <span className="inline-block size-2 rounded-full bg-accent" />
            <span className="font-serif text-lg font-medium tracking-tight">
              Inbox Assistant
            </span>
          </Link>
          <nav className="flex items-center gap-1">
            <NavLink href="/">Today</NavLink>
            <NavLink href="/runs">History</NavLink>
            <NavLink href="/settings">Settings</NavLink>
            <SignOutButton />
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 md:px-6 md:py-10">
        {children}
      </main>
      <footer className="border-t border-border py-5">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 text-xs text-muted-foreground md:px-6">
          <span className="font-mono uppercase tracking-widest">v1.0 · single user</span>
          <span>Powered by Workflow Dev Kit · AI SDK</span>
        </div>
      </footer>
    </div>
  )
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
    >
      {children}
    </Link>
  )
}
