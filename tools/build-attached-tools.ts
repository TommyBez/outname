import 'server-only'
import type { Tool } from 'ai'
import { eq } from 'drizzle-orm'
import {
  type ProviderRequirement,
  resolveCredentials,
} from '@/connectors/runtime'
import type { Reconnect } from '@/connectors/types'
import { db } from '@/lib/db'
import { agentTools } from '@/lib/db/schema'
import { getMaintainerTool } from './registry'

/**
 * Per-event entry point: load this agent's `agent_tools` rows, resolve
 * the credentials they need, and produce the AI-SDK ToolSet the agent
 * calls in this turn — alongside a list of reconnects the system prompt
 * surfaces so the model can ask the user for help.
 *
 * Failure isolation rules:
 *
 *   - A row pointing at an unknown id          → `tool_removed`
 *   - A row whose `config` doesn't parse       → `config_invalid`
 *   - A row whose required credentials are
 *     missing / expired / revoked / scope-gap  → reasons from runtime
 *   - A `tool.build()` that throws             → `build_failed`
 *
 * No path inside this function is allowed to propagate. One bad tool
 * never takes down the whole event.
 */
export interface BuildAttachedToolsResult {
  /** AI-SDK tool dictionary, keyed by tool id (e.g. "gmail_search"). */
  tools: Record<string, Tool>
  /** Reconnects to surface in the system prompt + UI. */
  reconnects: Reconnect[]
}

interface PlannedTool {
  toolId: string
  config: Record<string, unknown>
  requirements: ProviderRequirement[]
}

export async function buildAttachedTools(args: {
  agentId: string
  userId: string
}): Promise<BuildAttachedToolsResult> {
  const { agentId, userId } = args

  const rows = await db
    .select()
    .from(agentTools)
    .where(eq(agentTools.agentId, agentId))

  if (rows.length === 0) {
    return { tools: {}, reconnects: [] }
  }

  const planned: PlannedTool[] = []
  const reconnects: Reconnect[] = []

  // Pass 1: parse rows + validate config. Bad rows go straight to
  // reconnects with no provider id (tool-keyed reconnect reasons).
  for (const row of rows) {
    const tool = getMaintainerTool(row.toolId)
    if (!tool) {
      reconnects.push({ toolId: row.toolId, reason: 'tool_removed' })
      continue
    }
    let parsedConfig: Record<string, unknown> = {}
    if (tool.configSchema) {
      const result = tool.configSchema.safeParse(row.config ?? {})
      if (!result.success) {
        reconnects.push({
          toolId: row.toolId,
          reason: 'config_invalid',
          details: result.error.issues
            .map((i) => `${i.path.join('.') || '<root>'}: ${i.message}`)
            .join('; '),
        })
        continue
      }
      parsedConfig = result.data as Record<string, unknown>
    }
    planned.push({
      toolId: row.toolId,
      config: parsedConfig,
      requirements: tool.requirements
        .filter((r) => r.kind === 'connection')
        .map((r) => ({
          provider: r.provider,
          scopes: r.scopes,
          toolId: row.toolId,
        })),
    })
  }

  // Pass 2: resolve credentials for everything that survived. One DB
  // read + one refresh per provider, regardless of how many tools share
  // the connection.
  const requirements = planned.flatMap((p) => p.requirements)
  const { ready, reconnects: credentialReconnects } = await resolveCredentials({
    userId,
    requirements,
  })
  reconnects.push(...credentialReconnects)

  // Pass 3: build each remaining tool, isolated. Any tool that
  // attributed at least one reconnect from credential resolution is
  // skipped — we never call build() with a half-resolved bundle.
  const reconnectedToolIds = new Set(
    credentialReconnects.map((r) => ('toolId' in r ? r.toolId : ''))
  )
  const tools: Record<string, Tool> = {}
  for (const p of planned) {
    if (reconnectedToolIds.has(p.toolId)) {
      continue
    }
    const tool = getMaintainerTool(p.toolId)
    if (!tool) {
      // Should already be in reconnects, but keep the typecheck happy.
      continue
    }
    // Build the credentials slice the tool actually needs.
    const credentials: Record<string, unknown> = {}
    for (const req of p.requirements) {
      const raw = ready.get(req.provider)
      if (raw !== undefined) {
        credentials[req.provider] = raw
      }
    }
    try {
      tools[p.toolId] = tool.build({
        agentId,
        toolId: p.toolId,
        config: p.config,
        credentials,
      })
    } catch (err) {
      console.error('[v0] buildAttachedTools: build failed', {
        agentId,
        toolId: p.toolId,
        err,
      })
      reconnects.push({
        toolId: p.toolId,
        reason: 'build_failed',
        details: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return { tools, reconnects }
}
