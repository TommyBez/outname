import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function LegalSection({
  title,
  children,
  id,
}: {
  title: string
  children: ReactNode
  id?: string
}) {
  return (
    <section
      className="border-foreground border-t-2 pt-8 first:border-t-0 first:pt-0"
      id={id}
    >
      <h2 className="font-black font-serif text-2xl uppercase leading-none tracking-tighter sm:text-3xl">
        {title}
      </h2>
      <div className="mt-4 space-y-4 text-muted-foreground text-sm leading-relaxed">
        {children}
      </div>
    </section>
  )
}

export function LegalList({ children }: { children: ReactNode }) {
  return (
    <ul className="list-disc space-y-2 border-foreground border-l-2 pl-4">
      {children}
    </ul>
  )
}

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
      className={cn('font-bold text-accent underline-offset-4 hover:underline')}
      href={href}
      {...(external ? { rel: 'noopener noreferrer', target: '_blank' } : {})}
    >
      {children}
    </a>
  )
}
