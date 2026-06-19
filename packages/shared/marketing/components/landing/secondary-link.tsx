import { Button } from '@outname/ui/components/ui/button'
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
    <Button asChild className="w-full sm:w-auto" size="lg" variant="outline">
      <Link href={href}>
        <RouteIcon className="size-4" />
        {children}
      </Link>
    </Button>
  )
}
