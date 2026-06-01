import { AppShell } from '@outname/ui/components/layout/app-shell'

export default function AuthenticatedAppLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return <AppShell>{children}</AppShell>
}
