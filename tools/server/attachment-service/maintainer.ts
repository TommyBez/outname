import 'server-only'

import { and, eq } from 'drizzle-orm'
import { db } from '@/shared/db'
import { agentTools } from '@/shared/db/schema'
import { connectorBackedCapabilities } from '@/tools/catalog/capabilities'
import { getMaintainerTool } from '@/tools/catalog/registry'
import type { MaintainerTool } from '@/tools/catalog/types'
import {
  stripCredentialOverrides,
  toConfigRecord,
  withEncryptedCredentialOverrides,
} from '@/tools/runtime/define-maintainer-tool/api-key-override'
import { ensureToolSandboxBuild } from '@/tools/sandbox-runtime/build'
import { manifestHash } from '@/tools/sandboxes'
import {
  assertAgentOwnership,
  ownershipError,
  revalidateAgentToolSurfaces,
} from './shared'
import type { AttachOptions, AttachResult } from './types'

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
    return { ok: false, error: ownershipError(err) }
  }

  const tool = getMaintainerTool(input.toolId)
  if (!tool) {
    return { ok: false, error: 'Unknown tool.' }
  }

  const existingConfig = await readExistingMaintainerToolConfig({
    agentId: input.agentId,
    toolId: input.toolId,
  })
  const parsed = await parseMaintainerToolConfig(
    tool,
    input.rawConfig,
    existingConfig
  )
  if (!parsed.ok) {
    return { ok: false, error: parsed.error }
  }

  const sandbox = await resolveSandboxAttachState(tool)
  if (!sandbox.ok) {
    return { ok: false, error: sandbox.error }
  }

  await upsertMaintainerTool({
    agentId: input.agentId,
    toolId: input.toolId,
    config: parsed.config,
    sandbox: sandbox.state,
  })

  if (shouldRefresh) {
    const { refreshAgentCapabilitySummary } = await import(
      '@/agents/server/capability-summary'
    )
    await refreshAgentCapabilitySummary({ agentId: input.agentId })
  }
  if (shouldRevalidate) {
    revalidateAgentToolSurfaces(input.agentId, input.userId)
  }
  return { ok: true, pendingBuildId: sandbox.state.pendingBuildId }
}

async function parseMaintainerToolConfig(
  tool: MaintainerTool,
  rawConfig: Record<string, unknown>,
  existingConfig: unknown
): Promise<ConfigParseResult> {
  const allowedProviders = new Set(
    connectorBackedCapabilities(tool.capabilities).map(
      (capability) => capability.connectorId
    )
  )

  if (!tool.configSchema) {
    return await withEncryptedCredentialOverrides({
      allowedProviders,
      config: {},
      source: rawConfig,
      fallbackSource: existingConfig,
    })
  }

  const parsed = tool.configSchema.safeParse(
    stripCredentialOverrides(rawConfig)
  )
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid configuration.',
    }
  }

  const config = parsed.data
  return await withEncryptedCredentialOverrides({
    allowedProviders,
    config: toConfigRecord(config),
    source: rawConfig,
    fallbackSource: existingConfig,
  })
}

async function readExistingMaintainerToolConfig(input: {
  agentId: string
  toolId: string
}): Promise<unknown> {
  const [row] = await db
    .select({ config: agentTools.config })
    .from(agentTools)
    .where(
      and(
        eq(agentTools.agentId, input.agentId),
        eq(agentTools.kind, 'maintainer'),
        eq(agentTools.toolId, input.toolId)
      )
    )
    .limit(1)
  return row?.config
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

async function upsertMaintainerTool(input: {
  agentId: string
  config: Record<string, unknown>
  sandbox: SandboxAttachState
  toolId: string
}): Promise<void> {
  await db
    .insert(agentTools)
    .values({
      agentId: input.agentId,
      toolId: input.toolId,
      kind: 'maintainer',
      config: input.config,
      status: input.sandbox.rowStatus,
      toolSandboxManifest: input.sandbox.sandboxManifest,
      toolSandboxManifestHash: input.sandbox.sandboxManifestHash,
      toolSandboxError: null,
    })
    .onConflictDoUpdate({
      target: [agentTools.agentId, agentTools.kind, agentTools.toolId],
      set: {
        config: input.config,
        kind: 'maintainer',
        status: input.sandbox.rowStatus,
        toolSandboxManifest: input.sandbox.sandboxManifest,
        toolSandboxManifestHash: input.sandbox.sandboxManifestHash,
        updatedAt: new Date(),
      },
    })
}
