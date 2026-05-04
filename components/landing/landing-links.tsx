import { ArrowRightIcon, RouteIcon } from 'lucide-react'
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

export function PrimaryLink({
  href,
  children,
}: {
  href: string
  children: ReactNode
}) {
  return (
    <Link
      className="group ease inline-flex min-h-14 w-full items-center justify-center gap-4 border-2 border-foreground bg-foreground py-2 pr-2 pl-6 font-bold text-background text-xs uppercase tracking-normal transition-[transform,background-color,color,border-color] duration-150 hover:border-accent hover:bg-accent hover:text-foreground active:scale-[0.98] sm:w-auto"
      href={href}
    >
      {children}
      <span
        aria-hidden
        className="ease grid size-10 place-items-center bg-background text-foreground transition-transform duration-150 group-hover:translate-x-1"
      >
        <ArrowRightIcon className="size-4" />
      </span>
    </Link>
  )
}

export function SecondaryLink({
  href,
  children,
}: {
  href: string
  children: ReactNode
}) {
  return (
    <Link
      className="ease inline-flex min-h-14 w-full items-center justify-center gap-3 border-2 border-foreground bg-background px-6 font-bold text-xs uppercase tracking-normal transition-[transform,background-color,color] duration-150 hover:bg-foreground hover:text-background active:scale-[0.98] sm:w-auto"
      href={href}
    >
      <RouteIcon className="size-4" />
      {children}
    </Link>
  )
}
