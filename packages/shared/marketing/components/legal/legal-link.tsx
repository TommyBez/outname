import { cn } from '@outname/ui/lib/utils'
import type { ReactNode } from 'react'

export function LegalLink({
  href,
  children,
  external,
}: {
  href: string
  children: ReactNode
  external?: boolean
}) {
  return (
    <a
      className={cn('font-bold text-brand underline-offset-4 hover:underline')}
      href={href}
      {...(external ? { rel: 'noopener noreferrer', target: '_blank' } : {})}
    >
      {children}
    </a>
  )
}
