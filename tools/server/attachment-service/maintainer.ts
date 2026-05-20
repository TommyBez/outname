import 'server-only'

import { db } from '@/shared/db'
import { agentTools } from '@/shared/db/schema'
import { getMaintainerTool } from '@/tools/catalog/registry'
import type { MaintainerTool } from '@/tools/catalog/types'
import {
  stripApiKeyOverride,
  toConfigRecord,
  withApiKeyOverride,
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

  const parsed = parseMaintainerToolConfig(tool, input.rawConfig)
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

function parseMaintainerToolConfig(
  tool: MaintainerTool,
  rawConfig: Record<string, unknown>
): ConfigParseResult {
  if (!tool.configSchema) {
    return { ok: true, config: withApiKeyOverride({}, rawConfig) }
  }

  const parsed = tool.configSchema.safeParse(stripApiKeyOverride(rawConfig))
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid configuration.',
    }
  }

  const config = parsed.data
  return {
    ok: true,
    config: withApiKeyOverride(toConfigRecord(config), rawConfig),
  }
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
