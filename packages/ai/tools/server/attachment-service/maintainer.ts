import 'server-only'

import { connectorBackedCapabilities } from '@outname/ai/tools/catalog/capabilities'
import { getMaintainerTool } from '@outname/ai/tools/catalog/registry'
import type { MaintainerTool } from '@outname/ai/tools/catalog/types'
import {
  stripCredentialOverrides,
  toConfigRecord,
  withEncryptedCredentialOverrides,
} from '@outname/ai/tools/runtime/define-maintainer-tool/api-key-override'
import { manifestHash } from '@outname/ai/tools/sandboxes'
import { db } from '@outname/db'
import { agentTools } from '@outname/db/schema'
import { and, eq } from 'drizzle-orm'
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

export type EnsureToolSandboxBuild = (input: {
  manifestId: string
}) => Promise<
  | { state: 'ready'; snapshotId: string }
  | { state: 'building'; buildId: string }
>

interface SandboxAttachState {
  pendingBuildId?: string
  rowStatus: 'connected' | 'pending'
  sandboxManifest: string | null
  sandboxManifestHash: string | null
}

export async function attachMaintainerToolForUser(
  input: {
    agentId: string
    ensureSandboxBuild?: EnsureToolSandboxBuild
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

  const sandbox = await resolveSandboxAttachState({
    ensureSandboxBuild: input.ensureSandboxBuild,
    tool,
  })
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
      '@outname/shared/agents/server/capability-summary'
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

async function resolveSandboxAttachState(input: {
  ensureSandboxBuild?: EnsureToolSandboxBuild
  tool: MaintainerTool
}): Promise<SandboxAttachResult> {
  const sandboxManifest =
    input.tool.capabilities.find(
      (capability) => capability.kind === 'tool_sandbox'
    )?.manifest ?? null
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

  if (!input.ensureSandboxBuild) {
    return {
      ok: false,
      error: 'Sandbox build workflow is not available in this runtime.',
    }
  }

  try {
    const result = await input.ensureSandboxBuild({
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
