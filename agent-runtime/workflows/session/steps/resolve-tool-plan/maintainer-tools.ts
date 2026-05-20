import { and, desc, eq, inArray } from 'drizzle-orm'
import { db } from '@/shared/db'
import { toolSandboxBuilds, toolSandboxSnapshots } from '@/shared/db/schema'
import { providerBackedCapabilities } from '@/tools/catalog/capabilities'
import { getMaintainerTool } from '@/tools/catalog/registry'
import type { MaintainerTool, Reconnect } from '@/tools/catalog/types'
import {
  stripApiKeyOverride,
  toConfigRecord,
  withApiKeyOverride,
} from '@/tools/runtime/define-maintainer-tool/api-key-override'
import { getToolSandboxManifest } from '@/tools/sandboxes/registry'
import type { MaintainerRow, PlannedTool } from './types'

type MaintainerOutcome =
  | { kind: 'planned'; planned: PlannedTool }
  | { kind: 'reconnect'; reconnects: Reconnect[] }

type ParsedConfig =
  | {
      kind: 'parsed'
      config: Record<string, unknown>
      toolConfig: Record<string, unknown>
    }
  | { kind: 'reconnect'; reconnects: Reconnect[] }

export async function resolveMaintainerRow(
  row: MaintainerRow
): Promise<MaintainerOutcome> {
  const tool = getMaintainerTool(row.toolId)
  if (!tool) {
    return {
      kind: 'reconnect',
      reconnects: [{ toolId: row.toolId, reason: 'tool_removed' }],
    }
  }

  const parsed = parseMaintainerConfig(tool, row)
  if (parsed.kind === 'reconnect') {
    return parsed
  }

  const sandbox = await checkSandboxRequirements(tool, row.toolId)
  if (sandbox) {
    return { kind: 'reconnect', reconnects: [sandbox] }
  }

  return {
    kind: 'planned',
    planned: {
      toolId: row.toolId,
      config: parsed.config,
      toolConfig: parsed.toolConfig,
      providerRequirements: providerBackedCapabilities(tool.capabilities).map(
        (requirement) => ({
          provider: requirement.provider,
          toolId: row.toolId,
        })
      ),
    },
  }
}

function parseMaintainerConfig(
  tool: MaintainerTool,
  row: MaintainerRow
): ParsedConfig {
  if (!tool.configSchema) {
    return {
      kind: 'parsed',
      config: {},
      toolConfig: withApiKeyOverride({}, row.config),
    }
  }
  const result = tool.configSchema.safeParse(
    stripApiKeyOverride(row.config ?? {})
  )
  if (!result.success) {
    return {
      kind: 'reconnect',
      reconnects: [
        {
          toolId: row.toolId,
          reason: 'config_invalid',
          message: result.error.issues
            .map(
              (issue) => `${issue.path.join('.') || '<root>'}: ${issue.message}`
            )
            .join('; '),
        },
      ],
    }
  }
  const config = toConfigRecord(result.data)
  return {
    kind: 'parsed',
    config,
    toolConfig: withApiKeyOverride(config, row.config),
  }
}

async function checkSandboxRequirements(
  tool: MaintainerTool,
  toolId: string
): Promise<Reconnect | null> {
  for (const requirement of tool.capabilities) {
    if (requirement.kind !== 'tool_sandbox') {
      continue
    }
    const blocking = await checkSandboxRequirement(requirement.manifest, toolId)
    if (blocking) {
      return blocking
    }
  }
  return null
}

async function checkSandboxRequirement(
  manifestId: string,
  toolId: string
): Promise<Reconnect | null> {
  try {
    getToolSandboxManifest(manifestId)
  } catch {
    return {
      toolId,
      reason: 'tool_sandbox_unavailable',
      manifest: manifestId,
      message: `Tool sandbox manifest "${manifestId}" is not registered`,
    }
  }

  const desiredHash = await manifestHashStep({ manifestId })
  const [snapshot] = await db
    .select()
    .from(toolSandboxSnapshots)
    .where(
      and(
        eq(toolSandboxSnapshots.manifestId, manifestId),
        eq(toolSandboxSnapshots.manifestHash, desiredHash)
      )
    )
    .limit(1)

  if (snapshot && snapshot.manifestHash === desiredHash) {
    return null
  }

  const [build] = await db
    .select({ id: toolSandboxBuilds.id })
    .from(toolSandboxBuilds)
    .where(
      and(
        eq(toolSandboxBuilds.manifestId, manifestId),
        eq(toolSandboxBuilds.manifestHash, desiredHash),
        inArray(toolSandboxBuilds.status, ['pending', 'running'])
      )
    )
    .orderBy(desc(toolSandboxBuilds.startedAt))
    .limit(1)

  if (build) {
    return {
      toolId,
      reason: 'tool_sandbox_building',
      manifest: manifestId,
      buildId: build.id,
    }
  }
  return {
    toolId,
    reason: 'tool_sandbox_unavailable',
    manifest: manifestId,
    message: `No ready snapshot for "${manifestId}"`,
  }
}

async function manifestHashStep(input: {
  manifestId: string
}): Promise<string> {
  'use step'
  const { manifestHash } = await import('@/tools/sandboxes')
  return manifestHash(input.manifestId)
}
