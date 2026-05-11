import type { Metadata } from 'next'
import { Suspense } from 'react'
import { requireSession } from '@/auth/server/auth-guard'
import { ConnectionsList } from '@/connections/components/connections-list'
import { listConnectors } from '@/connections/registry'
import { AppShell } from '@/shared/components/layout/app-shell'
import { ConnectionsSectionSkeleton } from '@/shared/components/skeletons'
import { getCachedUserConnections } from '@/shared/server/data'
import { createPrivatePageMetadata } from '@/shared/server/site-metadata'

export const metadata: Metadata = createPrivatePageMetadata(
  'Connections',
  'Manage provider credentials and shared tool connections for OUTNA.ME agents.'
)

export default function ConnectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ connection?: string; reason?: string }>
}) {
  return (
    <AppShell>
      <header className="mb-12 border-foreground border-t-4 pt-6 md:mb-16">
        <p className="swiss-label mb-4 text-accent">09. Connections</p>
        <h1 className="font-black font-serif text-6xl uppercase leading-[0.9] tracking-tighter md:text-8xl">
          Connections
        </h1>
        <p className="mt-5 max-w-2xl border-foreground border-l-2 pl-4 text-muted-foreground text-sm leading-relaxed">
          Shared provider credentials used by agent tools. Connect each provider
          once, then attach tools from an agent workspace.
        </p>
      </header>

      <Suspense fallback={null}>
        <FlashNotice searchParams={searchParams} />
      </Suspense>

      <Suspense fallback={<ConnectionsSectionSkeleton />}>
        <ConnectionsSection />
      </Suspense>
    </AppShell>
  )
}

async function FlashNotice({
  searchParams,
}: {
  searchParams: Promise<{ connection?: string; reason?: string }>
}) {
  const sp = await searchParams
  if (sp.connection === 'error') {
    return (
      <div className="mb-10 border-destructive border-l-4 bg-muted py-3 pl-4">
        <p className="font-bold text-destructive text-xs uppercase tracking-[0.2em]">
          Connection failed
        </p>
        <p className="mt-1 text-muted-foreground text-sm">
          {sp.reason ?? 'unknown error'}
        </p>
      </div>
    )
  }
  if (sp.connection === 'connected') {
    return (
      <div className="mb-10 border-foreground border-l-4 bg-muted py-3 pl-4">
        <p className="font-black font-serif text-lg uppercase tracking-[-0.04em]">
          Connection saved.
        </p>
      </div>
    )
  }
  return null
}

async function ConnectionsSection() {
  const session = await requireSession()
  const rows = await getCachedUserConnections(session.user.id)

  const connectors = listConnectors().map((c) => ({
    provider: c.provider,
    kind: c.kind,
    displayName: c.displayName,
    description: c.description,
    apiKeyFields: c.kind === 'api_key' ? c.apiKey.fields : undefined,
  }))

  const connections = rows.map((r) => ({
    provider: r.provider,
    status: r.status as 'active' | 'invalid',
    metadata: (r.metadata ?? {}) as Record<string, unknown>,
    lastError: r.lastError,
    connectedAt: r.createdAt.toISOString(),
  }))

  return <ConnectionsList connections={connections} connectors={connectors} />
}
