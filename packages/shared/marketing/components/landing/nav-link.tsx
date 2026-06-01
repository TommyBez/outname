import Link from 'next/link'
import type { ReactNode } from 'react'

export function NavLink({
  href,
  children,
}: {
  href: string
  children: ReactNode
}) {
  return (
    <Link
      className="ease inline-flex min-h-11 items-center px-4 font-bold text-xs uppercase tracking-normal transition-colors duration-150 hover:bg-foreground hover:text-background"
      href={href}
    >
      {children}
    </Link>
  )
}
