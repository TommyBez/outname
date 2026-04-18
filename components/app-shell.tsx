import Link from "next/link"
import { SignOutButton } from "./sign-out-button"

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-svh flex flex-col bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-6 px-6 py-5 md:px-8">
          <Link href="/" className="font-serif text-lg font-medium tracking-tight">
            Inbox Assistant
          </Link>
          <nav className="flex items-center gap-6 text-sm">
            <NavLink href="/">Today</NavLink>
            <NavLink href="/runs">History</NavLink>
            <NavLink href="/settings">Settings</NavLink>
            <SignOutButton />
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-12 md:px-8 md:py-16">
        {children}
      </main>
    </div>
  )
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="text-muted-foreground transition-colors hover:text-foreground"
    >
      {children}
    </Link>
  )
}
