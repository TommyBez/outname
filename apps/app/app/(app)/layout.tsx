import { GlobalCommandPalette } from '@outname/shared/agents/components/global-command-palette'
import { AppShell } from '@outname/ui/components/layout/app-shell'
import { Suspense } from 'react'

export default function AuthenticatedAppLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <AppShell>
      {children}
      <Suspense fallback={null}>
        <GlobalCommandPalette />
      </Suspense>
    </AppShell>
  )
}
