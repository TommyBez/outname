import { ArrowRightIcon } from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'

export function PrimaryLink({
  href,
  children,
}: {
  href: string
  children: ReactNode
}) {
  return (
    <Link
      className="group ease inline-flex min-h-14 w-full items-center justify-center gap-4 border border-border bg-foreground py-2 pr-2 pl-6 font-bold text-background text-xs uppercase tracking-normal transition-[transform,background-color,color,border-color] duration-150 hover:border-brand hover:bg-brand hover:text-brand-foreground active:scale-[0.98] sm:w-auto"
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
