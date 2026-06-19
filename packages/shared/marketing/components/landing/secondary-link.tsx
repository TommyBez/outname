import { RouteIcon } from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'

export function SecondaryLink({
  href,
  children,
}: {
  href: string
  children: ReactNode
}) {
  return (
    <Link
      className="ease inline-flex min-h-14 w-full items-center justify-center gap-3 border border-border bg-background px-6 font-bold text-xs tracking-normal transition-[transform,background-color,color] duration-150 hover:bg-foreground hover:text-background active:scale-[0.98] sm:w-auto"
      href={href}
    >
      <RouteIcon className="size-4" />
      {children}
    </Link>
  )
}
