import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { requireSession } from '@/auth/server/auth-guard'
import { getConnector } from '@/connections/registry'
import {
  getCachedAgentByIdForUser,
  getCachedAgentsForUser,
  getCachedAgentTools,
  getCachedUserConnections,
} from '@/shared/server/data'
import { describeConfigSchema } from '@/shared/server/zod-config-fields'
import { providerBackedCapabilities } from '@/tools/catalog/capabilities'
import { listMaintainerTools } from '@/tools/catalog/registry'
import {
  SubAgentCatalog,
  type SubAgentCatalogEntry,
} from '@/tools/components/sub-agent-catalog'
import { ToolCatalog } from '@/tools/components/tool-catalog'
import type {
  ToolCatalogEntry,
  ToolConfigField,
} from '@/tools/components/tool-catalog/types'
import { redactApiKeyOverride } from '@/tools/runtime/define-maintainer-tool/api-key-override'
import { getLatestBuildForManifest } from '@/tools/sandbox-runtime/build'
import {
  childAgentIdFromSubAgentRow,
  isLegacySubAgentToolId,
  uniqueSubAgentToolId,
} from '@/tools/sub-agents/sub-agent-tool-name'

type Params = Promise<{ agentId: string }>

const API_KEY_OVERRIDE_FIELD: ToolConfigField = {
  name: 'apiKeyOverride',
  label: 'API Key Override',
  type: 'password',
  required: false,
  placeholder: 'Leave blank to keep the saved override',
  description:
    'Optional per-attachment API key. The value is encrypted at rest and is never shown after saving.',
}

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
  const maintainerAttachedRows = attachedRows.filter(
    (r) => r.kind === 'maintainer'
  )
  const subAgentAttachedRows = attachedRows.filter(
    (r) => r.kind === 'sub_agent'
  )
  const attachedByMaintainerToolId = new Map(
    maintainerAttachedRows.map((row) => [row.toolId, row])
  )

  const catalog: ToolCatalogEntry[] = listMaintainerTools().map((t) => {
    const attachedRow = attachedByMaintainerToolId.get(t.id)
    const attachedConfig = attachedRow
      ? redactApiKeyOverride(attachedRow.config)
      : undefined
    const providers = providerBackedCapabilities(t.capabilities).map(
      (r) => r.provider
    )
    const hasBrokeredHttp = t.capabilities.some(
      (r) => r.kind === 'brokered_http'
    )
    const sandboxManifest =
      t.capabilities.find((r) => r.kind === 'tool_sandbox')?.manifest ?? null
    return {
      toolId: t.id,
      displayName: t.displayName,
      description: t.description,
      exposedTools: [...t.resolveExposedTools(attachedConfig)],
      providers,
      toolSandboxManifest: sandboxManifest,
      configFields: hasBrokeredHttp
        ? [...describeConfigSchema(t.configSchema), API_KEY_OVERRIDE_FIELD]
        : describeConfigSchema(t.configSchema),
    }
  })

  // Partition attached rows: maintainer tools render through the
  // catalog; sub-agent rows mark which children are already attached
  // for the sub-agent catalog.
  const attachedByChildId = new Map(
    subAgentAttachedRows.map((r) => [
      childAgentIdFromSubAgentRow({
        config: r.config,
        toolId: r.toolId,
      }),
      r.toolId,
    ])
  )
  const childById = new Map(allUserAgents.map((a) => [a.id, a]))
  const usedSubAgentToolIds = new Set(
    maintainerAttachedRows.map((row) => row.toolId)
  )
  const displayToolIdByChildId = new Map<string, string>()

  for (const row of subAgentAttachedRows) {
    const childAgentId = childAgentIdFromSubAgentRow({
      config: row.config,
      toolId: row.toolId,
    })
    const child = childById.get(childAgentId)
    if (!child) {
      continue
    }
    const displayToolId =
      isLegacySubAgentToolId({
        childAgentId,
        toolId: row.toolId,
      }) || usedSubAgentToolIds.has(row.toolId)
        ? uniqueSubAgentToolId({
            childAgentId,
            childName: child.name,
            usedToolIds: usedSubAgentToolIds,
          })
        : row.toolId
    displayToolIdByChildId.set(childAgentId, displayToolId)
    usedSubAgentToolIds.add(displayToolId)
  }

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
      const manifestHash =
        maintainerAttachedRows.find((r) => r.toolSandboxManifest === m)
          ?.toolSandboxManifestHash ?? undefined
      const row = await getLatestBuildForManifest(m, manifestHash)
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
    config: redactApiKeyOverride(r.config),
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

  // Every other agent is a candidate. Self-attach is rejected at attach time,
  // cycle/depth at runtime, and disabled agents stay listed so delegations can
  // be pre-wired before they are turned on.
  const subAgentCandidates: SubAgentCatalogEntry[] = allUserAgents
    .filter((a) => a.id !== agentId)
    .map((a) => {
      const displayToolId =
        displayToolIdByChildId.get(a.id) ??
        uniqueSubAgentToolId({
          childAgentId: a.id,
          childName: a.name,
          usedToolIds: usedSubAgentToolIds,
        })
      if (!displayToolIdByChildId.has(a.id)) {
        usedSubAgentToolIds.add(displayToolId)
      }
      return {
        agentId: a.id,
        attachedToolId: attachedByChildId.get(a.id) ?? null,
        displayToolId,
        name: a.name,
        enabled: a.enabled,
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
            <h1 className="font-black font-serif text-4xl uppercase leading-[0.9] tracking-tighter sm:text-5xl lg:text-6xl xl:text-7xl">
              Tools
            </h1>
            <p className="text-muted-foreground text-sm">
              Maintainer tools the agent may call. Attach the ones you want this
              agent to use; configure their per-attachment settings; connect any
              required provider once on the connections page.
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
              href="/connections"
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
            see it as a readable <code className="font-mono">agent_*</code>{' '}
            tool, hand it a self-contained instruction, and receive its final
            text reply with the child trace visible inline.
          </p>
        </div>
        <SubAgentCatalog
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
