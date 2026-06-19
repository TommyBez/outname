import type { ReactNode } from 'react'

export function LegalList({ children }: { children: ReactNode }) {
  return (
    <ul className="list-disc space-y-2 border-border border-l pl-4">
      {children}
    </ul>
  )
}
