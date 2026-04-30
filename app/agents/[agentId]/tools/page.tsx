import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { ToolCatalog, type ToolCatalogEntry } from '@/components/tool-catalog'
import { getConnector } from '@/connectors/registry'
import { requireSession } from '@/lib/auth-guard'
import {
  getCachedAgentByIdForUser,
  getCachedAgentTools,
  getCachedUserConnections,
} from '@/lib/data'
import { describeConfigSchema } from '@/lib/zod-config-fields'
import { listMaintainerTools } from '@/tools/registry'

type Params = Promise<{ agentId: string }>

export default function AgentToolsPage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Resolved params={params} />
    </Suspense>
  )
}

async function Resolved({ params }: { params: Params }) {
  const { agentId } = await params
  const session = await requireSession()
  const agent = await getCachedAgentByIdForUser(agentId, session.user.id)
  if (!agent) {
    notFound()
  }

  const [attachedRows, connectionRows] = await Promise.all([
    getCachedAgentTools(agentId),
    getCachedUserConnections(session.user.id),
  ])

  const catalog: ToolCatalogEntry[] = listMaintainerTools().map((t) => {
    const providers = t.requirements
      .filter((r) => r.kind === 'connection')
      .map((r) => r.provider)
    return {
      toolId: t.id,
      displayName: t.displayName,
      description: t.description,
      providers,
      configFields: describeConfigSchema(t.configSchema),
    }
  })

  const attached = attachedRows.map((r) => ({
    toolId: r.toolId,
    config: (r.config ?? {}) as Record<string, unknown>,
  }))

  const connectionMap = new Map(connectionRows.map((c) => [c.provider, c]))
  const allProviders = new Set(catalog.flatMap((c) => c.providers))
  const connections = Array.from(allProviders).map((provider) => {
    const c = connectionMap.get(provider) ?? null
    const connector = getConnector(provider)
    return {
      provider,
      displayName: connector?.displayName ?? provider,
      status: c ? (c.status as 'active' | 'invalid') : null,
    }
  })

  return (
    <>
      <header className="mb-12 border-foreground border-t-4 pt-6">
        <div className="grid gap-8 md:grid-cols-[minmax(0,7fr)_minmax(16rem,3fr)]">
          <div className="flex flex-col gap-4">
            <p className="font-bold text-[10px] text-muted-foreground uppercase tracking-[0.2em]">
              {agent.name}
            </p>
            <h1 className="font-black font-serif text-5xl uppercase leading-[0.9] tracking-tighter md:text-7xl">
              Tools
            </h1>
            <p className="text-muted-foreground text-sm">
              Maintainer tools the agent may call. Attach the ones you want this
              agent to use; configure their per-attachment settings; connect any
              required provider once on the settings page.
            </p>
          </div>
          <div className="flex flex-wrap items-start gap-3 border-foreground border-l-2 pl-4 md:justify-end">
            <Link
              className="inline-flex h-10 items-center justify-center border-2 border-foreground px-4 font-bold text-xs uppercase tracking-[0.16em] transition-colors hover:bg-foreground hover:text-background"
              href={`/agents/${agentId}`}
            >
              ← Overview
            </Link>
            <Link
              className="inline-flex h-10 items-center justify-center border-2 border-foreground px-4 font-bold text-xs uppercase tracking-[0.16em] transition-colors hover:bg-foreground hover:text-background"
              href="/settings"
            >
              Connections →
            </Link>
          </div>
        </div>
      </header>

      <ToolCatalog
        agentId={agentId}
        attached={attached}
        catalog={catalog}
        connections={connections}
      />
    </>
  )
}

function PageSkeleton() {
  return (
    <header className="mb-12 border-foreground border-t-4 pt-6">
      <div className="h-3 w-24 animate-pulse rounded-sm bg-muted" />
      <div className="mt-4 h-12 w-64 animate-pulse rounded-sm bg-muted" />
    </header>
  )
}
