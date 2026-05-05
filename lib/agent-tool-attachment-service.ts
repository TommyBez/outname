import 'server-only'
import { and, eq } from 'drizzle-orm'
import { revalidateTag } from 'next/cache'
import { refreshAgentCapabilitySummary } from '@/lib/agent-capability-summary'
import { agentTag, agentToolsTag, userAgentsTag } from '@/lib/cache-tags'
import { db } from '@/lib/db'
import { type AgentToolKind, agent, agentTools } from '@/lib/db/schema'
import { ensureToolSandboxBuild } from '@/lib/tool-sandbox-build'
import { getMaintainerTool } from '@/tools/registry'
import { manifestHash } from '@/tools/sandboxes'
import {
  childAgentIdFromSubAgentRow,
  uniqueSubAgentToolId,
} from '@/tools/sub-agent-tool-name'
import type { MaintainerTool } from '@/tools/types'

export interface AttachResult {
  error?: string
  ok: boolean
  /**
   * When the tool depends on a tool-sandbox snapshot that has to be
   * built, this is the build id the UI can subscribe to.
   */
  pendingBuildId?: string
}

interface AttachOptions {
  refreshSummary?: boolean
  revalidate?: boolean
}

type ConfigParseResult =
  | { config: Record<string, unknown>; ok: true }
  | { error: string; ok: false }

type SandboxAttachResult =
  | { ok: true; state: SandboxAttachState }
  | { error: string; ok: false }

interface SandboxAttachState {
  pendingBuildId?: string
  rowStatus: 'connected' | 'pending'
  sandboxManifest: string | null
  sandboxManifestHash: string | null
}

export async function assertAgentOwnership(
  agentId: string,
  userId: string
): Promise<void> {
  const [row] = await db
    .select({ userId: agent.userId })
    .from(agent)
    .where(eq(agent.id, agentId))
    .limit(1)

  if (!row) {
    throw new Error('Agent not found.')
  }
  if (row.userId !== userId) {
    throw new Error('Forbidden.')
  }
}

export async function attachMaintainerToolForUser(
  input: {
    agentId: string
    rawConfig: Record<string, unknown>
    toolId: string
    userId: string
  } & AttachOptions
): Promise<AttachResult> {
  const shouldRefresh = input.refreshSummary ?? true
  const shouldRevalidate = input.revalidate ?? true

  try {
    await assertAgentOwnership(input.agentId, input.userId)
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Forbidden.',
    }
  }

  const tool = getMaintainerTool(input.toolId)
  if (!tool) {
    return { ok: false, error: 'Unknown tool.' }
  }

  const parsed = parseMaintainerToolConfig(tool, input.rawConfig)
  if (!parsed.ok) {
    return { ok: false, error: parsed.error }
  }

  const sandbox = await resolveSandboxAttachState(tool)
  if (!sandbox.ok) {
    return { ok: false, error: sandbox.error }
  }
  const { pendingBuildId, rowStatus, sandboxManifest, sandboxManifestHash } =
    sandbox.state

  await db
    .insert(agentTools)
    .values({
      agentId: input.agentId,
      toolId: input.toolId,
      kind: 'maintainer',
      config: parsed.config,
      status: rowStatus,
      toolSandboxManifest: sandboxManifest,
      toolSandboxManifestHash: sandboxManifestHash,
      toolSandboxError: null,
    })
    .onConflictDoUpdate({
      target: [agentTools.agentId, agentTools.kind, agentTools.toolId],
      set: {
        config: parsed.config,
        kind: 'maintainer',
        status: rowStatus,
        toolSandboxManifest: sandboxManifest,
        toolSandboxManifestHash: sandboxManifestHash,
        updatedAt: new Date(),
      },
    })

  if (shouldRefresh) {
    await refreshAgentCapabilitySummary({ agentId: input.agentId })
  }
  if (shouldRevalidate) {
    revalidateAgentToolSurfaces(input.agentId, input.userId)
  }
  return { ok: true, pendingBuildId }
}

function parseMaintainerToolConfig(
  tool: MaintainerTool,
  rawConfig: Record<string, unknown>
): ConfigParseResult {
  if (!tool.configSchema) {
    return { ok: true, config: {} }
  }

  const parsed = tool.configSchema.safeParse(rawConfig)
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid configuration.',
    }
  }

  const config = parsed.data
  if (typeof config === 'object' && config !== null && !Array.isArray(config)) {
    return { ok: true, config: config as Record<string, unknown> }
  }
  return { ok: true, config: {} }
}

async function resolveSandboxAttachState(
  tool: MaintainerTool
): Promise<SandboxAttachResult> {
  const sandboxManifest =
    tool.capabilities.find((capability) => capability.kind === 'tool_sandbox')
      ?.manifest ?? null
  const sandboxManifestHash = sandboxManifest
    ? manifestHash(sandboxManifest)
    : null

  if (!sandboxManifest) {
    return {
      ok: true,
      state: {
        rowStatus: 'connected',
        sandboxManifest,
        sandboxManifestHash,
      },
    }
  }

  try {
    const result = await ensureToolSandboxBuild({
      manifestId: sandboxManifest,
    })
    return {
      ok: true,
      state: {
        pendingBuildId:
          result.state === 'building' ? result.buildId : undefined,
        rowStatus: result.state === 'building' ? 'pending' : 'connected',
        sandboxManifest,
        sandboxManifestHash,
      },
    }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to start build.',
    }
  }
}

export async function attachSubAgentForUser(
  input: {
    childAgentId: string
    parentAgentId: string
    userId: string
  } & AttachOptions
): Promise<AttachResult> {
  const shouldRefresh = input.refreshSummary ?? true
  const shouldRevalidate = input.revalidate ?? true

  try {
    await assertAgentOwnership(input.parentAgentId, input.userId)
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Forbidden.',
    }
  }

  if (input.parentAgentId === input.childAgentId) {
    return {
      ok: false,
      error: 'An agent cannot delegate to itself.',
    }
  }

  const [child] = await db
    .select({ userId: agent.userId, enabled: agent.enabled, name: agent.name })
    .from(agent)
    .where(eq(agent.id, input.childAgentId))
    .limit(1)
  if (!child || child.userId !== input.userId) {
    return { ok: false, error: 'Sub-agent not found.' }
  }

  const rows = await db
    .select({
      config: agentTools.config,
      kind: agentTools.kind,
      toolId: agentTools.toolId,
    })
    .from(agentTools)
    .where(eq(agentTools.agentId, input.parentAgentId))

  const existingSubAgent = rows.find(
    (row) =>
      row.kind === 'sub_agent' &&
      childAgentIdFromSubAgentRow({
        config: row.config,
        toolId: row.toolId,
      }) === input.childAgentId
  )
  if (existingSubAgent) {
    if (shouldRefresh) {
      await refreshAgentCapabilitySummary({ agentId: input.parentAgentId })
    }
    if (shouldRevalidate) {
      if (shouldRefresh) {
        revalidateAgentToolSurfaces(input.parentAgentId, input.userId)
      } else {
        revalidateTag(agentToolsTag(input.parentAgentId), 'max')
      }
    }
    return { ok: true }
  }

  const usedToolIds = new Set(rows.map((row) => row.toolId))
  const toolId = uniqueSubAgentToolId({
    childAgentId: input.childAgentId,
    childName: child.name,
    usedToolIds,
  })
  await db
    .insert(agentTools)
    .values({
      agentId: input.parentAgentId,
      toolId,
      kind: 'sub_agent',
      config: { childAgentId: input.childAgentId },
      status: 'connected',
      toolSandboxManifest: null,
      toolSandboxManifestHash: null,
    })
    .onConflictDoUpdate({
      target: [agentTools.agentId, agentTools.kind, agentTools.toolId],
      set: {
        config: { childAgentId: input.childAgentId },
        kind: 'sub_agent',
        status: 'connected',
        toolSandboxManifest: null,
        toolSandboxManifestHash: null,
        updatedAt: new Date(),
      },
    })

  if (shouldRefresh) {
    await refreshAgentCapabilitySummary({ agentId: input.parentAgentId })
  }
  if (shouldRevalidate) {
    revalidateAgentToolSurfaces(input.parentAgentId, input.userId)
  }
  return { ok: true }
}

export async function detachToolForUser(input: {
  agentId: string
  kind?: AgentToolKind
  toolId: string
  userId: string
}): Promise<AttachResult> {
  try {
    await assertAgentOwnership(input.agentId, input.userId)
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Forbidden.',
    }
  }

  await db
    .delete(agentTools)
    .where(
      and(
        eq(agentTools.agentId, input.agentId),
        eq(agentTools.toolId, input.toolId),
        eq(agentTools.kind, input.kind ?? 'maintainer')
      )
    )

  await refreshAgentCapabilitySummary({ agentId: input.agentId })
  revalidateAgentToolSurfaces(input.agentId, input.userId)
  return { ok: true }
}

export function revalidateAgentToolSurfaces(
  agentId: string,
  userId: string
): void {
  revalidateTag(agentToolsTag(agentId), 'max')
  revalidateTag(agentTag(agentId), 'max')
  revalidateTag(userAgentsTag(userId), 'max')
}
