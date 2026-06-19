import { requireSession } from '@outname/auth/server/auth-guard'
import { ConnectionsList } from '@outname/shared/connections/components/connections-list'
import { humanizeConnectionFlashReason } from '@outname/shared/connections/flash-reason'
import { listConnectors } from '@outname/shared/connections/registry'
import { getCachedUserConnections } from '@outname/shared/server/data'
import { createPrivatePageMetadata } from '@outname/shared/server/site-metadata'
import { ConnectionsSectionSkeleton } from '@outname/ui/components/skeletons'
import type { Metadata } from 'next'
import { Suspense } from 'react'

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
    <>
      <header className="mb-12 border-border border-t-4 pt-6 md:mb-16">
        <p className="swiss-label mb-4 text-brand">09. Connections</p>
        <h1 className="font-semibold font-serif text-5xl leading-[0.9] tracking-tighter sm:text-6xl lg:text-7xl xl:text-8xl">
          Connections
        </h1>
        <p className="mt-5 max-w-2xl border-border border-l pl-4 text-muted-foreground text-sm leading-relaxed">
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
    </>
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
      <div className="mb-10 border-destructive border-l bg-muted py-3 pl-4">
        <p className="font-bold text-destructive text-xs">Connection failed</p>
        <p className="mt-1 text-muted-foreground text-sm">
          {humanizeConnectionFlashReason(sp.reason)}
        </p>
        {sp.reason ? (
          <p className="mt-1 font-mono text-muted-foreground text-xs">
            Detail: {sp.reason}
          </p>
        ) : null}
      </div>
    )
  }
  if (sp.connection === 'connected') {
    return (
      <div className="mb-10 border-border border-l bg-muted py-3 pl-4">
        <p className="font-semibold font-serif text-lg tracking-[-0.04em]">
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
    connectorId: c.connectorId,
    providerGroup: c.providerGroup,
    authKind: c.authKind,
    displayName: c.displayName,
    description: c.description,
    apiKeyFields: c.authKind === 'api_key' ? c.apiKey.fields : undefined,
    scopeCatalog: c.authKind === 'oauth2' ? c.oauth2.scopeCatalog : undefined,
  }))

  const connections = rows.map((r) => ({
    connectorId: r.connectorId,
    status: r.status as 'active' | 'invalid',
    metadata: (r.metadata ?? {}) as Record<string, unknown>,
    grantedScopes: r.grantedScopes as string[],
    lastError: r.lastError,
    connectedAt: r.createdAt.toISOString(),
  }))

  return <ConnectionsList connections={connections} connectors={connectors} />
}
