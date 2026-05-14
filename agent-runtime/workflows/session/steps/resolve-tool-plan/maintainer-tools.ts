import { and, desc, eq, inArray } from 'drizzle-orm'
import { db } from '@/shared/db'
import { toolSandboxBuilds, toolSandboxSnapshots } from '@/shared/db/schema'
import { getMaintainerTool } from '@/tools/catalog/registry'
import type { MaintainerTool, Reconnect } from '@/tools/catalog/types'
import { getToolSandboxManifest } from '@/tools/sandboxes/registry'
import type { MaintainerRow, PlannedTool } from './types'

type MaintainerOutcome =
  | { kind: 'planned'; planned: PlannedTool }
  | { kind: 'reconnect'; reconnects: Reconnect[] }

type ParsedConfig =
  | { kind: 'parsed'; config: Record<string, unknown> }
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

  const sandbox = await checkSandboxRequirements(
    tool,
    row.toolId,
    row.toolSandboxManifestHash
  )
  if (sandbox) {
    return { kind: 'reconnect', reconnects: [sandbox] }
  }

  return {
    kind: 'planned',
    planned: {
      toolId: row.toolId,
      config: parsed.config,
      providerRequirements: tool.capabilities
        .filter(
          (
            requirement
          ): requirement is {
            kind: 'brokered_http' | 'sdk'
            provider: string
          } =>
            requirement.kind === 'brokered_http' || requirement.kind === 'sdk'
        )
        .map((requirement) => ({
          provider: requirement.provider,
          toolId: row.toolId,
        })),
    },
  }
}

function parseMaintainerConfig(
  tool: MaintainerTool,
  row: MaintainerRow
): ParsedConfig {
  if (!tool.configSchema) {
    return { kind: 'parsed', config: {} }
  }
  const result = tool.configSchema.safeParse(row.config ?? {})
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
  return { kind: 'parsed', config: result.data as Record<string, unknown> }
}

async function checkSandboxRequirements(
  tool: MaintainerTool,
  toolId: string,
  toolSandboxManifestHash: string | null
): Promise<Reconnect | null> {
  for (const requirement of tool.capabilities) {
    if (requirement.kind !== 'tool_sandbox') {
      continue
    }
    const blocking = await checkSandboxRequirement(
      requirement.manifest,
      toolId,
      toolSandboxManifestHash
    )
    if (blocking) {
      return blocking
    }
  }
  return null
}

async function checkSandboxRequirement(
  manifestId: string,
  toolId: string,
  desiredHash: string | null
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

  if (!desiredHash) {
    return {
      toolId,
      reason: 'tool_sandbox_unavailable',
      manifest: manifestId,
      message: `Tool sandbox manifest hash for "${manifestId}" is missing. Reattach the tool to rebuild it.`,
    }
  }

  const [snapshot] = await db
    .select()
    .from(toolSandboxSnapshots)
    .where(eq(toolSandboxSnapshots.manifestId, manifestId))
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
