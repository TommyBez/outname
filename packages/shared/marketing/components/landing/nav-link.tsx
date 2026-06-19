import { Button } from '@outname/ui/components/ui/button'
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
    <Button asChild size="sm" variant="ghost">
      <Link href={href}>{children}</Link>
    </Button>
  )
}
