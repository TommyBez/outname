import type { ReactNode } from 'react'

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
      className="border-border border-t pt-8 first:border-t-0 first:pt-0"
      id={id}
    >
      <h2 className="font-semibold text-xl tracking-tight">{title}</h2>
      <div className="mt-4 space-y-4 text-muted-foreground text-sm leading-relaxed">
        {children}
      </div>
    </section>
  )
}
