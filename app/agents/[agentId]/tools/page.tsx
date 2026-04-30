import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import {
  SubAgentCatalog,
  type SubAgentCatalogEntry,
} from '@/components/sub-agent-catalog'
import { ToolCatalog, type ToolCatalogEntry } from '@/components/tool-catalog'
import { getConnector } from '@/connectors/registry'
import { requireSession } from '@/lib/auth-guard'
import {
  getCachedAgentByIdForUser,
  getCachedAgentsForUser,
  getCachedAgentTools,
  getCachedUserConnections,
} from '@/lib/data'
import { getLatestBuildForManifest } from '@/lib/tool-sandbox-build'
import { describeConfigSchema } from '@/lib/zod-config-fields'
import { AGENT_TOOL_PREFIX } from '@/tools/agent-tool-prefix'
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

  const [attachedRows, connectionRows, allUserAgents] = await Promise.all([
    getCachedAgentTools(agentId),
    getCachedUserConnections(session.user.id),
    getCachedAgentsForUser(session.user.id),
  ])

  const catalog: ToolCatalogEntry[] = listMaintainerTools().map((t) => {
    const providers = t.requirements
      .filter((r) => r.kind === 'connection')
      .map((r) => r.provider)
    const sandboxManifest =
      t.requirements.find((r) => r.kind === 'tool_sandbox')?.manifest ?? null
    return {
      toolId: t.id,
      displayName: t.displayName,
      description: t.description,
      providers,
      toolSandboxManifest: sandboxManifest,
      configFields: describeConfigSchema(t.configSchema),
    }
  })

  // Partition attached rows: maintainer tools render through the
  // catalog; sub-agent rows mark which children are already attached
  // for the sub-agent catalog.
  const maintainerAttachedRows = attachedRows.filter(
    (r) => !r.toolId.startsWith(AGENT_TOOL_PREFIX)
  )
  const attachedChildIds = new Set(
    attachedRows
      .filter((r) => r.toolId.startsWith(AGENT_TOOL_PREFIX))
      .map((r) => r.toolId.slice(AGENT_TOOL_PREFIX.length))
  )

  // Look up the most recent in-flight build for every pending row,
  // grouped by manifest so we hit the DB once per distinct manifest.
  const pendingManifests = new Set(
    maintainerAttachedRows
      .filter((r) => r.status === 'pending' && r.toolSandboxManifest)
      .map((r) => r.toolSandboxManifest as string)
  )
  const pendingBuildByManifest = new Map<string, string | null>()
  await Promise.all(
    Array.from(pendingManifests).map(async (m) => {
      const row = await getLatestBuildForManifest(m)
      pendingBuildByManifest.set(
        m,
        row && (row.status === 'pending' || row.status === 'running')
          ? row.id
          : null
      )
    })
  )

  const attached = maintainerAttachedRows.map((r) => ({
    toolId: r.toolId,
    config: (r.config ?? {}) as Record<string, unknown>,
    status: (r.status as 'connected' | 'pending') ?? 'connected',
    pendingBuildId:
      r.status === 'pending' && r.toolSandboxManifest
        ? (pendingBuildByManifest.get(r.toolSandboxManifest) ?? null)
        : null,
    toolSandboxError: r.toolSandboxError ?? null,
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

  // Sub-agents: every other agent the user owns is a candidate. The
  // attach action enforces "no self-attach"; resolveToolPlan enforces
  // cycle/depth at runtime. We deliberately allow disabled agents to
  // be listed so users can pre-wire delegations before turning them
  // on.
  const subAgentCandidates: SubAgentCatalogEntry[] = allUserAgents
    .filter((a) => a.id !== agentId)
    .map((a) => ({
      agentId: a.id,
      name: a.name,
      enabled: a.enabled,
    }))

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

      <section className="mt-16 border-foreground border-t-4 pt-6">
        <div className="mb-6 flex flex-col gap-2">
          <p className="font-bold text-[10px] text-muted-foreground uppercase tracking-[0.2em]">
            Delegation
          </p>
          <h2 className="font-black font-serif text-3xl uppercase leading-[0.9] tracking-tighter md:text-5xl">
            Sub-agents
          </h2>
          <p className="text-muted-foreground text-sm">
            Attach another one of your agents as a callable. This parent will
            see it as an <code className="font-mono">agent_&lt;id&gt;</code>{' '}
            tool, hand it a self-contained instruction, and receive its final
            text reply.
          </p>
        </div>
        <SubAgentCatalog
          attachedChildIds={attachedChildIds}
          candidates={subAgentCandidates}
          parentAgentId={agentId}
        />
      </section>
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
