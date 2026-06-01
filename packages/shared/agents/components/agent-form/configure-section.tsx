import type { ReactNode } from 'react'

export function ConfigureSection({
  children,
  description,
  id,
  title,
}: {
  children: ReactNode
  description: string
  id: string
  title: string
}) {
  return (
    <section className="scroll-mt-24" id={id}>
      <div className="mb-6 grid gap-2 md:grid-cols-[12rem_minmax(0,1fr)]">
        <h3 className="font-bold text-xs uppercase tracking-[0.18em]">
          {title}
        </h3>
        <p className="max-w-2xl text-muted-foreground text-sm">{description}</p>
      </div>
      {children}
    </section>
  )
}
