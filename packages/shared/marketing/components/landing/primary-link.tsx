import { Button } from '@outname/ui/components/ui/button'
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
    <Button asChild className="group w-full sm:w-auto" size="lg">
      <Link href={href}>
        {children}
        <span
          aria-hidden
          className="ease grid size-7 place-items-center bg-background text-foreground transition-transform duration-150 group-hover:translate-x-1"
        >
          <ArrowRightIcon className="size-4" />
        </span>
      </Link>
    </Button>
  )
}
