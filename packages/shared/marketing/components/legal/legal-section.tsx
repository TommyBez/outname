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
